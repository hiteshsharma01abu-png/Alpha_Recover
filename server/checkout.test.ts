import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { activityLogs, enrollments, notificationJobs, orders, payments, paymentWebhookEvents, plans, users } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { grantEnrollment } from './services/enrollments';
import { loadPlans } from './services/pricing';
import type { RazorpayPayment } from './services/razorpay';
import { type CookieJar, createTestContext, getJson, loginAs, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const KEYS = { RAZORPAY_KEY_ID: 'rzp_test_key123', RAZORPAY_KEY_SECRET: 'key-secret-for-tests', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret-for-tests' };
const sign = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

describe.skipIf(!dbAvailable)('checkout and Razorpay payments (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let student: { jar: CookieJar; id: string; email: string };
  /** Fake Razorpay: orders it created, and the payment state the API reports. */
  let rzpOrders: { id: string; amount: number; receipt: string }[];
  let rzpPayments: Map<string, RazorpayPayment>;
  let rzpFail = false;

  beforeAll(() => {
    ctx = createTestContext(KEYS);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedCatalog(ctx.db);
    await seedPlans(ctx.db);
    student = await loginAs(ctx, 'student', 'Ravi');
    rzpOrders = [];
    rzpPayments = new Map();
    rzpFail = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      expect(new Headers(init?.headers).get('authorization')).toBe(`Basic ${Buffer.from(`${KEYS.RAZORPAY_KEY_ID}:${KEYS.RAZORPAY_KEY_SECRET}`).toString('base64')}`);
      if (rzpFail) return Response.json({ error: { description: 'Server error' } }, { status: 500 });
      if (url === 'https://api.razorpay.com/v1/orders' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const order = { id: `order_T${rzpOrders.length + 1}abcdef`, amount: body.amount, receipt: body.receipt };
        rzpOrders.push(order);
        return Response.json({ ...order, status: 'created' });
      }
      const pay = url.match(/\/v1\/payments\/(pay_\w+)$/);
      if (pay && rzpPayments.has(pay[1])) return Response.json(rzpPayments.get(pay[1]));
      return Response.json({ error: { description: 'not found' } }, { status: 404 });
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const checkout = (planSlug: string, jar = student.jar, billing?: Record<string, unknown>) => postJson(ctx.app, '/checkout/orders', { planSlug, ...(billing ? { billing } : {}) }, jar);
  const payment = (orderId: string, amount: number, status: RazorpayPayment['status'] = 'captured', id = 'pay_P1abcdef'): RazorpayPayment => {
    const p = { id, order_id: orderId, amount, currency: 'INR', status, method: 'upi', error_code: status === 'failed' ? 'BAD_REQUEST_ERROR' : null, error_description: status === 'failed' ? 'Payment declined' : null };
    rzpPayments.set(id, p);
    return p;
  };
  const verify = (orderId: string, paymentId = 'pay_P1abcdef', signature = sign(KEYS.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), jar = student.jar) =>
    postJson(ctx.app, '/checkout/verify', { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }, jar);
  const webhook = (body: unknown, eventId: string, secret = KEYS.RAZORPAY_WEBHOOK_SECRET, app = ctx.app) => {
    const raw = JSON.stringify(body);
    return app.request('/api/v1/webhooks/razorpay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(secret, raw), 'X-Razorpay-Event-Id': eventId },
      body: raw,
    });
  };
  const capturedEvent = (p: RazorpayPayment, event = 'payment.captured') => ({ event, payload: { payment: { entity: p } } });
  const activeEnrollments = () => ctx.db.select().from(enrollments).where(eq(enrollments.status, 'active'));
  const emails = async () => (await ctx.db.select({ template: notificationJobs.template, to: notificationJobs.toAddress }).from(notificationJobs)).filter((j) => j.template !== 'verify_email');

  describe('creating an order', () => {
    it('answers 503 until Razorpay keys are set, and needs a login', async () => {
      const bare = createTestContext();
      try {
        const { jar } = await loginAs(bare, 'student');
        const res = await postJson(bare.app, '/checkout/orders', { planSlug: 'essential' }, jar);
        expect(res.status).toBe(503);
        expect(await bare.db.select().from(orders)).toHaveLength(0);
      } finally {
        await bare.close();
      }
      expect((await postJson(ctx.app, '/checkout/orders', { planSlug: 'essential' })).status).toBe(401);
    });

    it('prices on the server, creates the Razorpay order and returns what Checkout needs; a repeat reuses it', async () => {
      const res = await checkout('essential', student.jar, { phone: '63551 97917' });
      expect(res.status).toBe(201);
      const { data } = await readJson(res);
      expect(data).toMatchObject({ amountPaise: 99900, currency: 'INR', planName: 'Essential' });
      expect(data.orderNumber).toMatch(/^AR-ORD-\d{4}-000001$/);
      expect(data.razorpay).toEqual({ keyId: KEYS.RAZORPAY_KEY_ID, orderId: rzpOrders[0].id, prefill: { name: 'Ravi', email: student.email, contact: '+916355197917' } });
      expect(rzpOrders[0]).toMatchObject({ amount: 99900, receipt: data.orderNumber });
      expect(JSON.stringify(data)).not.toContain(KEYS.RAZORPAY_KEY_SECRET);

      const again = (await readJson(await checkout('essential'))).data;
      expect(again.orderNumber).toBe(data.orderNumber);
      expect(rzpOrders).toHaveLength(1);

      // A phone added to the profile after the order was created still pre-fills Checkout on reuse
      const other = await loginAs(ctx, 'student', 'Asha');
      expect((await readJson(await checkout('essential', other.jar))).data.razorpay.prefill.contact).toBe('');
      await ctx.db.update(users).set({ phone: '+919812345678' }).where(eq(users.id, other.id));
      expect((await readJson(await checkout('essential', other.jar))).data.razorpay.prefill.contact).toBe('+919812345678');
      expect(rzpOrders).toHaveLength(2);
    });

    it('uses the running sale price for the Professional Plan', async () => {
      const [pro] = await loadPlans(ctx.db, { slug: 'professional' });
      const { data } = await readJson(await checkout('professional'));
      expect(data.amountPaise).toBe(pro.effectivePricePaise);
      expect(rzpOrders[0].amount).toBe(pro.effectivePricePaise);
    });

    it('refuses Coming soon plans, unknown plans, plans you own, and anything once you have every course', async () => {
      expect((await checkout('expert')).status).toBe(422);
      expect((await checkout('nope')).status).toBe(404);
      const [essential] = await ctx.db.select().from(plans).where(eq(plans.slug, 'essential'));
      await grantEnrollment(ctx.db, { userId: student.id, planId: essential.id, source: 'manual' });
      expect((await checkout('essential')).status).toBe(409);

      const other = await loginAs(ctx, 'student', 'Asha');
      const [pro] = await ctx.db.select().from(plans).where(eq(plans.slug, 'professional'));
      await grantEnrollment(ctx.db, { userId: other.id, planId: pro.id, source: 'manual' });
      const res = await checkout('essential', other.jar);
      expect(res.status).toBe(409);
      expect((await readJson(res)).error.message).toMatch(/every course/);
      expect(rzpOrders).toHaveLength(0);
    });

    it('validates billing details and reports a Razorpay outage as 502 without leaving a payable order', async () => {
      expect((await checkout('essential', student.jar, { phone: 'abc' })).status).toBe(400);
      expect((await checkout('essential', student.jar, { gstin: '123' })).status).toBe(400);
      rzpFail = true;
      expect((await checkout('essential')).status).toBe(502);
      const [order] = await ctx.db.select().from(orders);
      expect(order.status).toBe('failed');
      rzpFail = false;
      expect((await checkout('essential')).status).toBe(201); // a fresh order, not the failed one
    });
  });

  describe('verifying the Checkout result', () => {
    it('activates the plan once: order paid, payment saved, enrollment, receipt + welcome emails, audit', async () => {
      const { data } = await readJson(await checkout('essential'));
      const orderId = data.razorpay.orderId;
      payment(orderId, 99900);

      const res = await verify(orderId);
      expect(res.status).toBe(200);
      const body = (await readJson(res)).data;
      expect(body).toMatchObject({ orderNumber: data.orderNumber, status: 'paid', planSlug: 'essential', enrollment: { planSlug: 'essential', status: 'active' } });

      const [order] = await ctx.db.select().from(orders);
      expect(order.status).toBe('paid');
      expect(order.paidAt).not.toBeNull();
      const [pay] = await ctx.db.select().from(payments);
      expect(pay).toMatchObject({ providerPaymentId: 'pay_P1abcdef', status: 'captured', amountPaise: 99900, method: 'upi' });
      const active = await activeEnrollments();
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({ userId: student.id, source: 'purchase', orderId: order.id, expiresAt: null });
      expect(await emails()).toEqual(
        expect.arrayContaining([
          { template: 'order_receipt', to: student.email },
          { template: 'enrollment_welcome', to: student.email },
        ]),
      );
      expect(await emails()).toHaveLength(2);
      expect((await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'order.paid'))).map((a) => a.metadata)).toEqual([
        { orderNumber: data.orderNumber, amountPaise: 99900, via: 'checkout' },
      ]);

      // The handler firing twice (double click, refresh) changes nothing
      expect((await verify(orderId)).status).toBe(200);
      expect(await activeEnrollments()).toHaveLength(1);
      expect(await emails()).toHaveLength(2);
      // …and the course is now open
      expect((await readJson(await getJson(ctx.app, '/me/orders', student.jar))).data.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([data.orderNumber]);
    });

    it('rejects a bad signature, someone else’s order, and a payment from another order', async () => {
      const { data } = await readJson(await checkout('essential'));
      const orderId = data.razorpay.orderId;
      payment(orderId, 99900);
      expect((await verify(orderId, 'pay_P1abcdef', 'f'.repeat(64))).status).toBe(400);
      expect(await activeEnrollments()).toHaveLength(0);

      const other = await loginAs(ctx, 'student', 'Asha');
      expect((await verify(orderId, 'pay_P1abcdef', undefined, other.jar)).status).toBe(404);

      payment('order_Totherorder1', 99900, 'captured', 'pay_P2abcdef');
      expect((await verify(orderId, 'pay_P2abcdef')).status).toBe(400);
      expect(await activeEnrollments()).toHaveLength(0);
    });

    it('never activates when Razorpay reports a different amount', async () => {
      const { data } = await readJson(await checkout('essential'));
      payment(data.razorpay.orderId, 100);
      const res = await verify(data.razorpay.orderId);
      expect(res.status).toBe(422);
      expect(await activeEnrollments()).toHaveLength(0);
      expect((await ctx.db.select().from(orders))[0].status).toBe('created');
    });

    it('records a failed payment and keeps the order payable; an authorized one waits for capture', async () => {
      const { data } = await readJson(await checkout('essential'));
      const orderId = data.razorpay.orderId;
      payment(orderId, 99900, 'failed');
      expect((await readJson(await verify(orderId))).data).toMatchObject({ status: 'failed', enrollment: null });
      expect((await ctx.db.select().from(payments))[0]).toMatchObject({ status: 'failed', errorDescription: 'Payment declined' });
      expect((await ctx.db.select().from(orders))[0].status).toBe('created');

      payment(orderId, 99900, 'authorized', 'pay_P3abcdef');
      expect((await readJson(await verify(orderId, 'pay_P3abcdef'))).data.status).toBe('processing');
      expect(await activeEnrollments()).toHaveLength(0);

      const detail = (await readJson(await getJson(ctx.app, `/me/orders/${data.orderNumber}`, student.jar))).data;
      expect(detail).toMatchObject({ status: 'created', lastPayment: { status: 'failed', method: 'upi' } });
      expect((await getJson(ctx.app, `/me/orders/${data.orderNumber}`, (await loginAs(ctx, 'student')).jar)).status).toBe(404);
    });
  });

  describe('webhook', () => {
    it('answers 503 without a webhook secret and 400 for a bad signature (not stored)', async () => {
      const bare = createTestContext({ RAZORPAY_KEY_ID: KEYS.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: KEYS.RAZORPAY_KEY_SECRET });
      try {
        expect((await webhook({ event: 'payment.captured' }, 'evt_1', KEYS.RAZORPAY_WEBHOOK_SECRET, bare.app)).status).toBe(503);
      } finally {
        await bare.close();
      }
      expect((await webhook({ event: 'payment.captured' }, 'evt_1', 'wrong-secret')).status).toBe(400);
      expect(await ctx.db.select().from(paymentWebhookEvents)).toHaveLength(0);
    });

    it('activates the order when the browser never came back, once per event id, and agrees with a later verify', async () => {
      const { data } = await readJson(await checkout('essential'));
      const p = payment(data.razorpay.orderId, 99900);

      const res = await webhook(capturedEvent(p), 'evt_cap_1');
      expect(res.status).toBe(200);
      expect(await activeEnrollments()).toHaveLength(1);
      expect((await ctx.db.select().from(paymentWebhookEvents))[0]).toMatchObject({ eventId: 'evt_cap_1', status: 'processed', signatureValid: true });

      expect(await readJson(await webhook(capturedEvent(p), 'evt_cap_1'))).toEqual({ ok: true, duplicate: true });
      expect((await webhook(capturedEvent(p, 'order.paid'), 'evt_paid_1')).status).toBe(200); // second event, same payment
      expect((await verify(data.razorpay.orderId)).status).toBe(200);
      expect(await activeEnrollments()).toHaveLength(1);
      expect(await emails()).toHaveLength(2);
      expect((await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'order.paid'))).map((a) => (a.metadata as { via: string }).via)).toEqual(['webhook']);
    });

    it('records failures, ignores other events and foreign orders, and retries a delivery that failed', async () => {
      const { data } = await readJson(await checkout('essential'));
      const orderId = data.razorpay.orderId;
      const failed = { id: 'pay_F1abcdef', order_id: orderId, amount: 99900, currency: 'INR', status: 'failed' as const, method: 'card', error_code: 'X', error_description: 'Declined' };
      await webhook(capturedEvent(failed, 'payment.failed'), 'evt_f');
      expect((await ctx.db.select().from(payments))[0].status).toBe('failed');

      await webhook({ event: 'refund.created', payload: {} }, 'evt_r');
      await webhook(capturedEvent({ ...failed, id: 'pay_X1abcdef', order_id: 'order_Tforeign1', status: 'captured' }), 'evt_x');
      const statuses = Object.fromEntries((await ctx.db.select().from(paymentWebhookEvents)).map((e) => [e.eventId, e.status]));
      expect(statuses).toEqual({ evt_f: 'processed', evt_r: 'ignored', evt_x: 'ignored' });

      // A processing error is stored as failed; Razorpay's retry of the same event id then succeeds
      const p = payment(orderId, 99900, 'captured', 'pay_P9abcdef');
      await ctx.db.update(plans).set({ accessDays: 365 }).where(eq(plans.slug, 'essential'));
      await ctx.db.insert(paymentWebhookEvents).values({ eventId: 'evt_retry', eventType: 'payment.captured', payload: {}, signatureValid: true, status: 'failed', error: 'db down' });
      expect((await webhook(capturedEvent(p), 'evt_retry')).status).toBe(200);
      const [enrollment] = await activeEnrollments();
      expect(enrollment.expiresAt).not.toBeNull(); // 365-day plan
      expect((await ctx.db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.eventId, 'evt_retry')))[0].status).toBe('processed');
    });
  });

  it('the maintenance cron cancels unpaid orders past their window, and checkout then starts a new one', async () => {
    const first = (await readJson(await checkout('essential'))).data;
    await ctx.db.update(orders).set({ expiresAt: new Date(Date.now() - 1000) });
    const res = await ctx.app.request('/api/v1/internal/cron/maintenance', { method: 'POST', headers: { Authorization: `Bearer ${ctx.env.CRON_SECRET}` } });
    expect((await readJson(res)).data.cancelledOrders).toBe(1);
    const second = (await readJson(await checkout('essential'))).data;
    expect(second.orderNumber).not.toBe(first.orderNumber);
    expect(second.orderNumber).toMatch(/-000002$/);
  });
});
