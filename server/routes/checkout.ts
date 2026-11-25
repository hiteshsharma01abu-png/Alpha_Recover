import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../audit';
import { getUser, requireUser } from '../auth/middleware';
import { orders, payments, plans } from '../db/schema';
import { AppError } from '../lib/errors';
import { normalizePhone } from '../lib/phone';
import { rateLimit } from '../lib/ratelimit';
import { validate } from '../lib/validate';
import { activateOrder, ORDER_NUMBER, recordFailedPayment, startCheckout } from '../services/orders';
import { checkoutSignatureValid, fetchRazorpayPayment } from '../services/razorpay';
import type { AppEnv } from '../types';

const checkoutInput = z
  .object({
    planSlug: z.string().regex(/^[a-z0-9-]{1,64}$/),
    billing: z
      .object({
        name: z.string().trim().max(160).optional(),
        phone: z
          .string()
          .trim()
          .max(25)
          .optional()
          .transform((v, ctx) => {
            if (!v) return null;
            const e164 = normalizePhone(v);
            if (!e164) ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
            return e164;
          }),
        gstin: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN')
          .optional(),
      })
      .strict()
      .default({ phone: null }),
  })
  .strict();

const verifyInput = z
  .object({
    razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
    razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
    razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const PURCHASED = ['paid', 'refunded', 'partially_refunded'] as const;

const orderDto = (o: typeof orders.$inferSelect, plan: { slug: string; name: string }) => ({
  orderNumber: o.orderNumber,
  status: o.status,
  planSlug: plan.slug,
  planName: plan.name,
  amountPaise: o.amountPaise,
  currency: o.currency,
  createdAt: o.createdAt.toISOString(),
  paidAt: o.paidAt?.toISOString() ?? null,
});

/** Checkout and order history (docs/API.md §7). The webhook in routes/webhooks.ts is the second path to the same activateOrder(). */
export const checkoutRoutes = new Hono<AppEnv>()
  .post('/checkout/orders', requireUser(), rateLimit({ name: 'checkout', limit: 20, windowSeconds: 60 * 60 }), validate('json', checkoutInput), async (c) => {
    const { db, env } = c.get('deps');
    const user = (await getUser(c))!;
    const { planSlug, billing } = c.req.valid('json');
    const session = await startCheckout(db, env, { userId: user.id, planSlug, billing });
    return c.json({ data: session }, 201);
  })

  /** Checkout's success handler: signature check, then Razorpay's own word on the payment before anything is granted. */
  .post('/checkout/verify', requireUser(), rateLimit({ name: 'checkout-verify', limit: 30, windowSeconds: 60 * 60 }), validate('json', verifyInput), async (c) => {
    const { db, env } = c.get('deps');
    const user = (await getUser(c))!;
    const input = c.req.valid('json');
    const [row] = await db
      .select({ order: orders, plan: { slug: plans.slug, name: plans.name } })
      .from(orders)
      .innerJoin(plans, eq(plans.id, orders.planId))
      .where(and(eq(orders.providerOrderId, input.razorpayOrderId), eq(orders.userId, user.id)));
    if (!row) throw new AppError('NOT_FOUND', 'Order not found');
    if (!env.RAZORPAY_KEY_SECRET || !checkoutSignatureValid(env.RAZORPAY_KEY_SECRET, input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
      await logActivity(c, { action: 'order.verify_failed', entityType: 'order', entityId: row.order.id, metadata: { reason: 'signature' } });
      throw new AppError('VALIDATION_ERROR', 'We could not confirm this payment. If money was deducted, contact us with your order number.');
    }

    const payment = await fetchRazorpayPayment(env, input.razorpayPaymentId);
    if (payment.order_id !== input.razorpayOrderId) throw new AppError('VALIDATION_ERROR', 'This payment belongs to a different order');

    if (payment.status === 'captured') {
      const result = await activateOrder(db, env, row.order.id, payment);
      if (result.activated) {
        await logActivity(c, { action: 'order.paid', entityType: 'order', entityId: row.order.id, metadata: { orderNumber: row.order.orderNumber, amountPaise: payment.amount, via: 'checkout' } });
      }
      return c.json({ data: { ...orderDto(result.order, row.plan), enrollment: { planSlug: row.plan.slug, status: 'active' } } });
    }
    if (payment.status === 'failed') {
      await recordFailedPayment(db, row.order.id, payment);
      return c.json({ data: { ...orderDto(row.order, row.plan), status: 'failed' as const, enrollment: null } });
    }
    // authorized but not captured yet: the payment.captured webhook (or reconciliation) finishes it
    return c.json({ data: { ...orderDto(row.order, row.plan), status: 'processing' as const, enrollment: null } });
  })

  /** Purchase history: paid orders and their refunds, newest first. */
  .get('/me/orders', requireUser(), async (c) => {
    c.header('Cache-Control', 'no-store');
    const user = (await getUser(c))!;
    const rows = await c
      .get('deps')
      .db.select({ order: orders, plan: { slug: plans.slug, name: plans.name } })
      .from(orders)
      .innerJoin(plans, eq(plans.id, orders.planId))
      .where(and(eq(orders.userId, user.id), inArray(orders.status, [...PURCHASED])))
      .orderBy(desc(orders.createdAt));
    return c.json({ data: rows.map((r) => orderDto(r.order, r.plan)) });
  })

  /** One of your orders in any state (the checkout result page reads it). */
  .get('/me/orders/:orderNumber', requireUser(), validate('param', z.object({ orderNumber: z.string().regex(ORDER_NUMBER) })), async (c) => {
    c.header('Cache-Control', 'no-store');
    const { db } = c.get('deps');
    const user = (await getUser(c))!;
    const [row] = await db
      .select({ order: orders, plan: { slug: plans.slug, name: plans.name } })
      .from(orders)
      .innerJoin(plans, eq(plans.id, orders.planId))
      .where(and(eq(orders.orderNumber, c.req.valid('param').orderNumber), eq(orders.userId, user.id)));
    if (!row) throw new AppError('NOT_FOUND', 'Order not found');
    const [lastPayment] = await db
      .select({ status: payments.status, method: payments.method, errorDescription: payments.errorDescription })
      .from(payments)
      .where(eq(payments.orderId, row.order.id))
      .orderBy(desc(payments.updatedAt))
      .limit(1);
    return c.json({ data: { ...orderDto(row.order, row.plan), lastPayment: lastPayment ?? null } });
  });
