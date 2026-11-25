import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { activityLogs, enrollments, notificationJobs, orders, payments, paymentWebhookEvents } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import type { RazorpayPayment } from './services/razorpay';
import { type CookieJar, createTestContext, getJson, loginAs, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const KEYS = { RAZORPAY_KEY_ID: 'rzp_test_key123', RAZORPAY_KEY_SECRET: 'key-secret-for-tests', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret-for-tests' };
const sign = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');
const DAY = 86_400_000;

describe.skipIf(!dbAvailable)('admin orders, refunds and revenue (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let rzpOrders: { id: string; amount: number }[];
  let rzpPayments: Map<string, RazorpayPayment>;
  let refundCalls: { paymentId: string; amount: number }[];
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
    rzpOrders = [];
    rzpPayments = new Map();
    refundCalls = [];
    rzpFail = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (rzpFail) return Response.json({ error: { description: 'Server error' } }, { status: 500 });
      if (url === 'https://api.razorpay.com/v1/orders' && init?.method === 'POST') {
        const order = { id: `order_T${rzpOrders.length + 1}abcdef`, amount: JSON.parse(String(init.body)).amount };
        rzpOrders.push(order);
        return Response.json({ ...order, status: 'created' });
      }
      const refund = url.match(/\/v1\/payments\/(pay_\w+)\/refund$/);
      if (refund && init?.method === 'POST') {
        const amount = JSON.parse(String(init.body)).amount;
        refundCalls.push({ paymentId: refund[1], amount });
        return Response.json({ id: `rfnd_R${refundCalls.length}abcdef`, payment_id: refund[1], amount, status: 'processed' });
      }
      const orderPays = url.match(/\/v1\/orders\/(order_\w+)\/payments$/);
      if (orderPays) return Response.json({ items: [...rzpPayments.values()].filter((p) => p.order_id === orderPays[1]) });
      const pay = url.match(/\/v1\/payments\/(pay_\w+)$/);
      if (pay && rzpPayments.has(pay[1])) return Response.json(rzpPayments.get(pay[1]));
      return Response.json({ error: { description: 'not found' } }, { status: 404 });
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const payment = (orderId: string, amount: number, status: RazorpayPayment['status'] = 'captured', id = `pay_P${rzpPayments.size + 1}abcdef`): RazorpayPayment => {
    const p = { id, order_id: orderId, amount, currency: 'INR', status, method: 'upi', error_code: null, error_description: null };
    rzpPayments.set(id, p);
    return p;
  };
  /** A student who bought `plan` through checkout + verify. */
  async function buyer(plan = 'essential', name = 'Ravi') {
    const s = await loginAs(ctx, 'student', name);
    const { data } = await readJson(await postJson(ctx.app, '/checkout/orders', { planSlug: plan }, s.jar));
    const p = payment(data.razorpay.orderId, data.amountPaise);
    const res = await postJson(ctx.app, '/checkout/verify', { razorpayOrderId: data.razorpay.orderId, razorpayPaymentId: p.id, razorpaySignature: sign(KEYS.RAZORPAY_KEY_SECRET, `${data.razorpay.orderId}|${p.id}`) }, s.jar);
    expect(res.status).toBe(200);
    const [order] = await ctx.db.select().from(orders).where(eq(orders.orderNumber, data.orderNumber));
    return { ...s, order, paymentId: p.id };
  }
  const refund = (id: string, jar: CookieJar, reason = 'Customer asked within the window') => postJson(ctx.app, `/admin/orders/${id}/refund`, { reason }, jar);
  const activeEnrollments = (userId: string) => ctx.db.select().from(enrollments).where(eq(enrollments.userId, userId)).then((r) => r.filter((e) => e.status === 'active'));

  describe('list, detail and export', () => {
    it('lists purchases by default (unpaid attempts with status=all), masks emails, filters and counts', async () => {
      const a = await buyer('essential', 'Asha');
      const b = await buyer('professional', 'Bina');
      const c = await loginAs(ctx, 'student', 'Chetan');
      await postJson(ctx.app, '/checkout/orders', { planSlug: 'essential' }, c.jar); // never paid
      const staff = await loginAs(ctx, 'finance_manager');

      const { data, meta } = await readJson(await getJson(ctx.app, '/admin/orders', staff.jar));
      expect(data.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([b.order.orderNumber, a.order.orderNumber]);
      expect(data[0]).toMatchObject({ status: 'paid', plan: 'Professional Plan', method: 'upi', student: { firstName: 'Bina' } });
      expect(data[0].student.email).toMatch(/^\w{2}\*\*\*@example\.com$/);
      expect(meta).toMatchObject({ total: 2, counts: { paid: 2, created: 1 } });

      expect((await readJson(await getJson(ctx.app, '/admin/orders?status=all', staff.jar))).meta.total).toBe(3);
      expect((await readJson(await getJson(ctx.app, '/admin/orders?status=created', staff.jar))).data).toHaveLength(1);
      expect((await readJson(await getJson(ctx.app, `/admin/orders?q=${a.order.orderNumber}`, staff.jar))).data).toHaveLength(1);
      expect((await readJson(await getJson(ctx.app, '/admin/orders?q=Bina', staff.jar))).data[0].orderNumber).toBe(b.order.orderNumber);

      const csv = await (await getJson(ctx.app, '/admin/orders/export.csv', staff.jar)).text();
      expect(csv).toContain(a.order.orderNumber);
      expect(csv).toContain('999.00');
    });

    it('shows the order with payments, the access it granted, webhook deliveries and whether this viewer may refund', async () => {
      const a = await buyer();
      const admin = await loginAs(ctx, 'admin');
      const { data } = await readJson(await getJson(ctx.app, `/admin/orders/${a.order.id}`, admin.jar));
      expect(data).toMatchObject({ orderNumber: a.order.orderNumber, status: 'paid', plan: { slug: 'essential' }, student: { id: a.id, email: a.email } });
      expect(data.payments).toEqual([expect.objectContaining({ providerPaymentId: a.paymentId, status: 'captured', method: 'upi', amountPaise: 99900 })]);
      expect(data.enrollment).toMatchObject({ status: 'active' });
      expect(data.activity.map((x: { action: string }) => x.action)).toContain('order.paid');
      expect(data.refund).toMatchObject({ allowed: true, insideWindow: true });
    });

    it('finance, admin and super admin manage orders; support may only look; content and students are kept out', async () => {
      const a = await buyer();
      for (const role of ['content_manager', 'student'] as const) {
        expect((await getJson(ctx.app, '/admin/orders', (await loginAs(ctx, role)).jar)).status).toBe(403);
      }
      for (const role of ['support_manager', 'finance_manager', 'admin', 'super_admin'] as const) {
        expect((await getJson(ctx.app, '/admin/orders', (await loginAs(ctx, role)).jar)).status).toBe(200);
      }
      const support = await loginAs(ctx, 'support_manager');
      expect((await readJson(await getJson(ctx.app, `/admin/orders/${a.order.id}`, support.jar))).data.refund).toMatchObject({ allowed: false });
      expect((await postJson(ctx.app, `/admin/orders/${a.order.id}/reconcile`, {}, support.jar)).status).toBe(403);
      expect((await getJson(ctx.app, '/admin/orders/export.csv', support.jar)).status).toBe(403);
    });
  });

  describe('refunds', () => {
    it('refunds in full through Razorpay, ends the access, emails the buyer and audits it', async () => {
      const a = await buyer();
      const admin = await loginAs(ctx, 'admin');
      const res = await refund(a.order.id, admin.jar);
      expect(res.status).toBe(200);
      expect((await readJson(res)).data).toMatchObject({ status: 'refunded', accessRevoked: true, refundStatus: 'processed', amountPaise: 99900 });
      expect(refundCalls).toEqual([{ paymentId: a.paymentId, amount: 99900 }]);

      expect((await ctx.db.select().from(orders).where(eq(orders.id, a.order.id)))[0].status).toBe('refunded');
      expect((await ctx.db.select().from(payments))[0]).toMatchObject({ status: 'refunded', refundedPaise: 99900 });
      expect(await activeEnrollments(a.id)).toHaveLength(0);
      const jobs = await ctx.db.select({ template: notificationJobs.template, to: notificationJobs.toAddress }).from(notificationJobs);
      expect(jobs).toContainEqual({ template: 'refund_processed', to: a.email });
      const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'order.refund'));
      expect(log.metadata).toMatchObject({ amountPaise: 99900, via: 'admin', reason: 'Customer asked within the window' });

      // One refund per purchase
      expect((await refund(a.order.id, admin.jar)).status).toBe(409);
      expect(refundCalls).toHaveLength(1);
      expect((await readJson(await getJson(ctx.app, `/admin/orders/${a.order.id}`, admin.jar))).data.refund).toMatchObject({ allowed: false, reason: expect.stringMatching(/already been refunded/) });
    });

    it('applies the refund window and role limits; only paid orders', async () => {
      const a = await buyer('essential', 'Asha');
      const admin = await loginAs(ctx, 'admin');
      const finance = await loginAs(ctx, 'finance_manager');
      const owner = await loginAs(ctx, 'super_admin');

      // Above the Admin ceiling (₹5,000)
      await ctx.db.update(orders).set({ amountPaise: 600000 }).where(eq(orders.id, a.order.id));
      expect((await refund(a.order.id, admin.jar)).status).toBe(403);
      await ctx.db.update(orders).set({ amountPaise: 99900 }).where(eq(orders.id, a.order.id));

      // Day 4: outside the 3-day window, Super Admin only
      await ctx.db.update(orders).set({ paidAt: new Date(Date.now() - 4 * DAY) }).where(eq(orders.id, a.order.id));
      for (const jar of [admin.jar, finance.jar]) {
        const res = await refund(a.order.id, jar);
        expect(res.status).toBe(403);
        expect((await readJson(res)).error.message).toMatch(/Super Admin/);
      }
      expect(refundCalls).toHaveLength(0);
      expect((await refund(a.order.id, owner.jar, 'Goodwill exception')).status).toBe(200);

      const c = await loginAs(ctx, 'student', 'Chetan');
      await postJson(ctx.app, '/checkout/orders', { planSlug: 'essential' }, c.jar);
      const [unpaid] = await ctx.db.select().from(orders).where(eq(orders.userId, c.id));
      expect((await refund(unpaid.id, owner.jar)).status).toBe(409);
      expect((await refund(a.order.id, (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
    });

    it('changes nothing when Razorpay refuses the refund', async () => {
      const a = await buyer();
      rzpFail = true;
      const res = await refund(a.order.id, (await loginAs(ctx, 'super_admin')).jar);
      expect(res.status).toBe(502);
      expect((await readJson(res)).error.message).toMatch(/Razorpay refused the refund: “Server error”/);
      expect((await ctx.db.select().from(orders).where(eq(orders.id, a.order.id)))[0].status).toBe('paid');
      expect(await activeEnrollments(a.id)).toHaveLength(1);
    });

    it('records a refund made in the Razorpay dashboard (refund.processed), once', async () => {
      const a = await buyer();
      const body = { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_Dash1abcdef', payment_id: a.paymentId, amount: 99900, status: 'processed' } } } };
      const send = (eventId: string) => {
        const raw = JSON.stringify(body);
        return ctx.app.request('/api/v1/webhooks/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(KEYS.RAZORPAY_WEBHOOK_SECRET, raw), 'X-Razorpay-Event-Id': eventId }, body: raw });
      };
      expect((await send('evt_rf1')).status).toBe(200);
      expect((await ctx.db.select().from(orders).where(eq(orders.id, a.order.id)))[0].status).toBe('refunded');
      expect(await activeEnrollments(a.id)).toHaveLength(0);
      expect((await send('evt_rf2')).status).toBe(200); // a second delivery under a new id is a no-op
      const refundEmails = (await ctx.db.select().from(notificationJobs)).filter((j) => j.template === 'refund_processed');
      expect(refundEmails).toHaveLength(1);
      expect((await ctx.db.select().from(paymentWebhookEvents)).map((e) => e.status)).toEqual(['processed', 'processed']);
      const { data } = await readJson(await getJson(ctx.app, `/admin/orders/${a.order.id}`, (await loginAs(ctx, 'admin')).jar));
      expect(data.webhookEvents.map((e: { eventType: string }) => e.eventType)).toEqual(['refund.processed', 'refund.processed']);
    });
  });

  it('records a partial refund made in the Razorpay dashboard without ending access', async () => {
    const a = await buyer();
    const raw = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_Part1abcdef', payment_id: a.paymentId, amount: 100, status: 'processed' } } } });
    const res = await ctx.app.request('/api/v1/webhooks/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(KEYS.RAZORPAY_WEBHOOK_SECRET, raw), 'X-Razorpay-Event-Id': 'evt_part' }, body: raw });
    expect(res.status).toBe(200);
    expect((await ctx.db.select().from(orders).where(eq(orders.id, a.order.id)))[0].status).toBe('partially_refunded');
    expect((await ctx.db.select().from(payments))[0]).toMatchObject({ status: 'partially_refunded', refundedPaise: 100 });
    expect(await activeEnrollments(a.id)).toHaveLength(1);
    const owner = await loginAs(ctx, 'super_admin');
    expect((await readJson(await getJson(ctx.app, `/admin/orders/${a.order.id}`, owner.jar))).data.refund.allowed).toBe(false);
  });

  describe('re-check with Razorpay', () => {
    it('activates an order whose confirmation never arrived, and reports when nothing was paid', async () => {
      const s = await loginAs(ctx, 'student', 'Ravi');
      const { data } = await readJson(await postJson(ctx.app, '/checkout/orders', { planSlug: 'essential' }, s.jar));
      const [order] = await ctx.db.select().from(orders).where(eq(orders.orderNumber, data.orderNumber));
      const finance = await loginAs(ctx, 'finance_manager');
      const recheck = async () => (await readJson(await postJson(ctx.app, `/admin/orders/${order.id}/reconcile`, {}, finance.jar))).data.result;

      expect(await recheck()).toBe('nothing_yet');
      payment(data.razorpay.orderId, 99900, 'captured');
      expect(await recheck()).toBe('activated');
      expect(await activeEnrollments(s.id)).toHaveLength(1);
      expect(await recheck()).toBe('already_paid');
      const actions = (await ctx.db.select().from(activityLogs)).map((a) => a.action);
      expect(actions.filter((a) => a === 'order.paid')).toHaveLength(1);
      expect(actions.filter((a) => a === 'order.reconcile')).toHaveLength(3);
    });
  });

  it('dashboard revenue (orders.view only) and the revenue report', async () => {
    const a = await buyer('essential', 'Asha');
    await buyer('essential', 'Bina');
    const owner = await loginAs(ctx, 'super_admin');
    await refund(a.order.id, owner.jar);

    const dash = (await readJson(await getJson(ctx.app, '/admin/dashboard', owner.jar))).data;
    expect(dash.revenue).toMatchObject({ netPaise: 99900, paidOrders: 2, refunds: 1, last7Days: { netPaise: 99900, paidOrders: 2 } });
    expect(dash.revenue.recent).toHaveLength(2);
    expect((await readJson(await getJson(ctx.app, '/admin/dashboard', (await loginAs(ctx, 'content_manager')).jar))).data.revenue).toBeUndefined();

    const report = (await readJson(await getJson(ctx.app, '/admin/reports/revenue', owner.jar))).data;
    expect(report.totals).toEqual({ netInr: 999, grossInr: 1998, refundsInr: 999, paidOrders: 2, refundCount: 1, averageOrderInr: 999 });
    expect(report.series.points.reduce((n: number, p: { count: number }) => n + p.count, 0)).toBe(999);
    expect(report.breakdowns.plan).toEqual([{ key: 'Essential', count: 2 }]);
    expect(report.breakdowns.method).toEqual([{ key: 'upi', count: 2 }]);
    expect((await getJson(ctx.app, '/admin/reports/revenue', (await loginAs(ctx, 'content_manager')).jar)).status).toBe(403);
  });
});
