import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { logActivity } from '../audit';
import { orders, paymentWebhookEvents } from '../db/schema';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { activateOrder, recordFailedPayment, recordProviderRefund } from '../services/orders';
import { type RazorpayPayment, type RazorpayRefund, webhookSignatureValid } from '../services/razorpay';
import type { AppEnv } from '../types';

type RazorpayEvent = { event: string; payload?: { payment?: { entity: RazorpayPayment }; refund?: { entity: RazorpayRefund } } };

const HANDLED = new Set(['payment.captured', 'order.paid', 'payment.failed']);
const REFUND_EVENTS = new Set(['refund.processed', 'refund.failed']);

/**
 * Razorpay webhooks (docs/API.md §7): the source of truth when the buyer's browser never comes back.
 * Exempt from the CSRF guard; authenticated by the HMAC of the raw body. Each event id is processed
 * once; a delivery that failed is retried by Razorpay and processed again.
 */
export const webhookRoutes = new Hono<AppEnv>().post('/webhooks/razorpay', async (c) => {
  const { db, env } = c.get('deps');
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError('SERVICE_UNAVAILABLE', 'Webhooks are not configured');
  const raw = await c.req.text();
  const signature = c.req.header('x-razorpay-signature') ?? '';
  if (!webhookSignatureValid(env.RAZORPAY_WEBHOOK_SECRET, raw, signature)) {
    // Not stored: a forged event id must never block the real delivery
    logger.warn('razorpay webhook signature invalid', { requestId: c.get('requestId') });
    throw new AppError('VALIDATION_ERROR', 'Invalid signature');
  }

  let body: RazorpayEvent;
  try {
    body = JSON.parse(raw) as RazorpayEvent;
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid JSON');
  }
  const eventId = c.req.header('x-razorpay-event-id') ?? `${body.event}:${body.payload?.refund?.entity.id ?? body.payload?.payment?.entity.id ?? 'unknown'}`;

  await db
    .insert(paymentWebhookEvents)
    .values({ eventId, eventType: body.event.slice(0, 64), payload: body, signatureValid: true })
    .onDuplicateKeyUpdate({ set: { eventId } });
  const [event] = await db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.eventId, eventId));
  if (event.status === 'processed' || event.status === 'ignored') return c.json({ ok: true, duplicate: true });

  const finish = (status: 'processed' | 'ignored' | 'failed', error: string | null = null) =>
    db.update(paymentWebhookEvents).set({ status, error, processedAt: new Date() }).where(eq(paymentWebhookEvents.id, event.id));

  const refund = body.payload?.refund?.entity;
  if (REFUND_EVENTS.has(body.event) && refund) {
    if (body.event === 'refund.failed') {
      // The money didn't go back: staff see this on the order and must retry from the Razorpay dashboard
      logger.error('razorpay refund failed', { eventId, refundId: refund.id, paymentId: refund.payment_id });
      await finish('failed', `Refund ${refund.id} failed at Razorpay`);
      return c.json({ ok: true });
    }
    const result = await recordProviderRefund(db, refund);
    if (result.matched && result.changed) {
      await logActivity(c, { actor: null, action: 'order.refund', entityType: 'order', entityId: result.order.id, metadata: { orderNumber: result.order.orderNumber, amountPaise: refund.amount, refundId: refund.id, via: 'webhook' } });
    }
    await finish(result.matched ? 'processed' : 'ignored', result.matched ? null : 'no matching payment');
    return c.json({ ok: true });
  }

  const payment = body.payload?.payment?.entity;
  if (!HANDLED.has(body.event) || !payment?.order_id) {
    await finish('ignored');
    return c.json({ ok: true });
  }
  const [order] = await db.select().from(orders).where(eq(orders.providerOrderId, payment.order_id));
  if (!order) {
    // A payment for an order this site didn't create (another integration on the same account)
    await finish('ignored', 'no matching order');
    return c.json({ ok: true });
  }

  try {
    if (body.event === 'payment.failed') {
      await recordFailedPayment(db, order.id, payment);
    } else {
      const result = await activateOrder(db, env, order.id, payment);
      if (result.activated) {
        await logActivity(c, { actor: null, action: 'order.paid', entityType: 'order', entityId: order.id, metadata: { orderNumber: order.orderNumber, amountPaise: payment.amount, via: 'webhook' } });
      }
    }
    await finish('processed');
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish('failed', message);
    logger.error('razorpay webhook failed', { eventId, event: body.event, orderNumber: order.orderNumber, error: message });
    // An amount mismatch won't fix itself on retry; anything else gets Razorpay's retries
    if (err instanceof AppError && err.code === 'BUSINESS_RULE') return c.json({ ok: false });
    throw err;
  }
});
