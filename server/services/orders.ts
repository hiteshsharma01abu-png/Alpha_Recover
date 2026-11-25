import { and, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { pricingPlans } from '../../src/data/content';
import type { Database } from '../db';
import { enrollments, orders, payments, plans, promotions, users } from '../db/schema';
import type { Env } from '../env';
import { AppError } from '../lib/errors';
import { enqueueEmail } from '../notifications/outbox';
import { grantEnrollment, liveEnrollment } from './enrollments';
import { loadPlans } from './pricing';
import { createRazorpayOrder, razorpayKeyId, type RazorpayEnv, type RazorpayPayment } from './razorpay';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** An unpaid order (and its Razorpay order) is reused for this long, then the maintenance cron cancels it. */
export const ORDER_TTL_MS = 30 * 60 * 1000;
export const ORDER_NUMBER = /^AR-ORD-\d{4}-\d{6}$/;

const indiaYear = (d: Date) => Number(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4));

/** AR-ORD-YYYY-NNNNNN, gap-free per India year (same counter technique as certificate codes). */
async function allocateOrderNumber(tx: Tx, year: number) {
  await tx.execute(sql`
    INSERT INTO order_sequences (\`year\`, last_number) VALUES (${year}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`);
  const [rows] = (await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`)) as unknown as [{ n: number | string }[]];
  return `AR-ORD-${year}-${String(Number(rows[0].n)).padStart(6, '0')}`;
}

/** Plans the pricing page shows as "Coming soon" (Expert until mentoring exists) can't be bought. */
export const purchasable = (slug: string) => !pricingPlans.find((p) => p.slug === slug)?.comingSoon;

export type CheckoutSession = {
  orderNumber: string;
  amountPaise: number;
  currency: string;
  planName: string;
  razorpay: { keyId: string; orderId: string; prefill: { name: string; email: string; contact: string } };
};

/**
 * Starts (or resumes) checkout for a plan: the price comes from priceFor() on the server, an open order
 * with the same amount is reused, and a new one gets its Razorpay order before the buyer sees Checkout.
 */
export async function startCheckout(
  db: Database,
  env: Env,
  input: { userId: string; planSlug: string; billing: { name?: string | null; phone?: string | null; gstin?: string | null } },
  fetchImpl: typeof fetch = fetch,
): Promise<CheckoutSession> {
  const keyId = razorpayKeyId(env); // 503 before anything is written when payments aren't configured
  const [priced] = await loadPlans(db, { slug: input.planSlug });
  if (!priced) throw new AppError('NOT_FOUND', 'Plan not found');
  if (!purchasable(priced.slug)) throw new AppError('BUSINESS_RULE', `${priced.name} isn't available to buy yet`);
  const [plan] = await db.select().from(plans).where(eq(plans.slug, priced.slug));
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));

  const now = new Date();
  const live = await db
    .select({ planId: enrollments.planId, grantsAll: plans.grantsAllCourses })
    .from(enrollments)
    .innerJoin(plans, eq(plans.id, enrollments.planId))
    .where(and(eq(enrollments.userId, user.id), liveEnrollment(now)));
  if (live.some((e) => e.planId === plan.id)) throw new AppError('CONFLICT', `You already have the ${priced.name}`);
  if (live.some((e) => e.grantsAll)) throw new AppError('CONFLICT', 'Your plan already includes every course');

  const amountPaise = priced.effectivePricePaise;
  const prefill = (o: { billingName: string; billingEmail: string; billingPhone: string | null }) => ({
    name: o.billingName,
    email: o.billingEmail,
    contact: o.billingPhone ?? '',
  });

  const [open] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, user.id),
        eq(orders.planId, plan.id),
        eq(orders.status, 'created'),
        eq(orders.amountPaise, amountPaise),
        gt(orders.expiresAt, new Date(now.getTime() + 60_000)), // at least a minute left to pay
        isNotNull(orders.providerOrderId),
      ),
    )
    .limit(1);
  if (open) {
    // A phone added to the profile since the order was created still pre-fills Checkout
    const billingPhone = input.billing.phone || open.billingPhone || user.phone;
    return {
      orderNumber: open.orderNumber,
      amountPaise,
      currency: open.currency,
      planName: priced.name,
      razorpay: { keyId, orderId: open.providerOrderId!, prefill: prefill({ ...open, billingPhone }) },
    };
  }

  const promotionId = priced.promotion
    ? ((
        await db
          .select({ id: promotions.id })
          .from(promotions)
          .where(and(eq(promotions.planId, plan.id), eq(promotions.salePricePaise, amountPaise), eq(promotions.isActive, true)))
          .limit(1)
      )[0]?.id ?? null)
    : null;
  const billingName = input.billing.name?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
  const created = await db.transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, indiaYear(now));
    const [row] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: user.id,
        planId: plan.id,
        promotionId,
        amountPaise,
        currency: priced.currency,
        billingName,
        billingEmail: user.email,
        billingPhone: input.billing.phone || user.phone,
        billingCountry: user.country,
        gstin: input.billing.gstin || null,
        expiresAt: new Date(now.getTime() + ORDER_TTL_MS),
      })
      .$returningId();
    return { id: row.id, orderNumber };
  });

  const rzp = await createRazorpayOrder(
    env,
    { amountPaise, currency: priced.currency, receipt: created.orderNumber, notes: { orderId: created.id, orderNumber: created.orderNumber, plan: priced.slug } },
    fetchImpl,
  ).catch(async (err: unknown) => {
    // Never leave an order that can't be paid
    await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, created.id));
    throw err;
  });
  await db.update(orders).set({ providerOrderId: rzp.id }).where(eq(orders.id, created.id));
  return {
    orderNumber: created.orderNumber,
    amountPaise,
    currency: priced.currency,
    planName: priced.name,
    razorpay: { keyId, orderId: rzp.id, prefill: prefill({ billingName, billingEmail: user.email, billingPhone: input.billing.phone || user.phone }) },
  };
}

export type Activation = {
  activated: boolean;
  order: typeof orders.$inferSelect;
  planSlug: string;
  planName: string;
};

/** Saves the gateway's view of a payment (insert or update by Razorpay payment id). */
async function upsertPayment(tx: Tx, orderId: string, p: RazorpayPayment, status: (typeof payments.$inferInsert)['status']) {
  const values = {
    orderId,
    providerPaymentId: p.id,
    amountPaise: p.amount,
    status,
    method: p.method,
    errorCode: p.error_code,
    errorDescription: p.error_description,
    raw: p,
    capturedAt: status === 'captured' ? new Date() : null,
  };
  await tx
    .insert(payments)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        status: values.status,
        method: values.method,
        errorCode: values.errorCode,
        errorDescription: values.errorDescription,
        raw: values.raw,
        // keep the first capture time
        capturedAt: sql`coalesce(${payments.capturedAt}, ${values.capturedAt})`,
      },
    });
}

/**
 * Marks an order paid and grants its plan, exactly once (docs/API.md §7 activateOrder). Shared by
 * /checkout/verify, the webhook and reconciliation; whichever arrives first activates, the rest no-op.
 * The caller has already confirmed with Razorpay that `payment` is captured.
 */
export async function activateOrder(db: Database, env: Env, orderId: string, payment: RazorpayPayment): Promise<Activation> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const [plan] = await tx.select().from(plans).where(eq(plans.id, order.planId));
    await upsertPayment(tx, order.id, payment, 'captured');
    const result = { order, planSlug: plan.slug, planName: plan.name };
    if (order.status === 'paid' || order.status === 'refunded' || order.status === 'partially_refunded') return { ...result, activated: false };
    if (payment.amount !== order.amountPaise || payment.currency !== order.currency) {
      throw new AppError('BUSINESS_RULE', 'The payment amount does not match the order. Our team will check it and contact you.');
    }

    const paidAt = new Date();
    await tx.update(orders).set({ status: 'paid', paidAt }).where(eq(orders.id, order.id));
    // A cancelled (expired) or failed order that still gets paid is honoured: the money was taken.
    const expiresAt = plan.accessDays ? new Date(paidAt.getTime() + plan.accessDays * 86_400_000) : null;
    await grantEnrollment(tx as unknown as Database, { userId: order.userId, planId: order.planId, source: 'purchase', orderId: order.id, expiresAt });

    const [user] = await tx.select({ firstName: users.firstName, email: users.email }).from(users).where(eq(users.id, order.userId));
    const amount = formatInr(order.amountPaise);
    await enqueueEmail(tx as unknown as Database, 'order_receipt', order.billingEmail, {
      firstName: user.firstName,
      orderNumber: order.orderNumber,
      planName: plan.name,
      amount,
      paidAt: paidAt.toISOString(),
      method: payment.method,
      paymentId: payment.id,
    });
    await enqueueEmail(tx as unknown as Database, 'enrollment_welcome', user.email, {
      firstName: user.firstName,
      planName: plan.name,
      dashboardUrl: new URL('/dashboard', env.APP_URL).href,
      lifetime: !expiresAt,
    });
    return { ...result, order: { ...order, status: 'paid' as const, paidAt }, activated: true };
  });
}

/** A failed attempt (declined card, UPI timeout): recorded; the order stays payable until it expires. */
export async function recordFailedPayment(db: Database, orderId: string, payment: RazorpayPayment) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) return;
    await upsertPayment(tx, order.id, payment, 'failed');
  });
}

/** Unpaid orders past their window: cancelled so they're never reused (maintenance cron). */
export async function cancelStaleOrders(db: Database, now = new Date()) {
  const result = await db
    .update(orders)
    .set({ status: 'cancelled' })
    .where(and(inArray(orders.status, ['created']), lte(orders.expiresAt, now)));
  return result[0].affectedRows;
}

export const formatInr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);

export type { RazorpayEnv };
