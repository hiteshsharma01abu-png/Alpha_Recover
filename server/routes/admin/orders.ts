import { and, count, desc, eq, gte, inArray, like, lt, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { getUser, requireStaff } from '../../auth/middleware';
import { activityLogs, enrollments, ORDER_STATUSES, orders, paymentWebhookEvents, payments, plans, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { csvCell, maskEmail } from '../../lib/mask';
import { validate } from '../../lib/validate';
import { reconcileOrder, refundEligibility, refundOrder } from '../../services/orders';
import type { AppEnv } from '../../types';

/** What "all purchases" means in the list: orders money actually moved for. Unpaid attempts need status=all. */
const PURCHASED = ['paid', 'refunded', 'partially_refunded'] as const;
const STATUS_FILTER = [...ORDER_STATUSES, 'all'] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const filters = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUS_FILTER).optional(),
  planId: z.uuid().optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});
type Filters = z.infer<typeof filters>;

/** Start of an India-time day, as a UTC instant. */
const istDay = (d: string) => new Date(`${d}T00:00:00+05:30`);

function conditions(f: Filters, withStatus = true): SQL[] {
  const where: SQL[] = [];
  if (withStatus) {
    if (!f.status) where.push(inArray(orders.status, [...PURCHASED]));
    else if (f.status === 'refunded') where.push(inArray(orders.status, ['refunded', 'partially_refunded']));
    else if (f.status !== 'all') where.push(eq(orders.status, f.status));
  }
  if (f.planId) where.push(eq(orders.planId, f.planId));
  if (f.from) where.push(gte(orders.createdAt, istDay(f.from)));
  if (f.to) where.push(lt(orders.createdAt, new Date(istDay(f.to).getTime() + 86_400_000)));
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(or(like(orders.orderNumber, term), like(orders.billingName, term), like(orders.billingEmail, term), like(users.firstName, term), like(users.email, term))!);
  }
  return where;
}

/** Method of the most recent payment attempt (upi, card…). */
const lastMethod = sql<string | null>`(select p.method from ${payments} p where p.order_id = ${orders.id} order by p.updated_at desc limit 1)`;

const columns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  amountPaise: orders.amountPaise,
  currency: orders.currency,
  createdAt: orders.createdAt,
  paidAt: orders.paidAt,
  userId: orders.userId,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  planId: orders.planId,
  plan: plans.name,
  method: lastMethod,
};

const iso = (d: Date | null) => d?.toISOString() ?? null;
const idParam = z.object({ id: z.uuid() });

/** Orders & Payments admin module (docs/admin/NAVIGATION.md §3): purchases, refunds, reconciliation. */
export const adminOrderRoutes = new Hono<AppEnv>()
  .get(
    '/orders',
    requireStaff('orders.view'),
    validate('query', filters.extend({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) })),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const where = and(...conditions(q));
      const base = conditions(q, false);
      const [rows, [{ total }], statusCounts] = await Promise.all([
        db
          .select(columns)
          .from(orders)
          .innerJoin(users, eq(users.id, orders.userId))
          .innerJoin(plans, eq(plans.id, orders.planId))
          .where(where)
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(where),
        db
          .select({ status: orders.status, n: count() })
          .from(orders)
          .innerJoin(users, eq(users.id, orders.userId))
          .where(and(...base))
          .groupBy(orders.status),
      ]);
      const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(statusCounts.find((r) => r.status === s)?.n ?? 0)]));
      return c.json({
        data: rows.map(({ firstName, lastName, email, userId, ...r }) => ({
          ...r,
          student: { id: userId, firstName, lastName, email: maskEmail(email) },
          createdAt: r.createdAt.toISOString(),
          paidAt: iso(r.paidAt),
        })),
        meta: { page: q.page, pageSize: q.pageSize, total: Number(total), counts },
      });
    },
  )

  /** Plans for the filter (any status: old orders may belong to a retired plan). */
  .get('/orders/plans', requireStaff('orders.view'), async (c) => {
    const rows = await c.get('deps').db.select({ id: plans.id, name: plans.name }).from(plans).orderBy(plans.sortOrder);
    return c.json({ data: rows });
  })

  .get('/orders/export.csv', requireStaff('orders.export'), validate('query', filters), async (c) => {
    const f = c.req.valid('query');
    const { db } = c.get('deps');
    const rows = await db
      .select({ ...columns, billingName: orders.billingName, billingPhone: orders.billingPhone, gstin: orders.gstin })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(plans, eq(plans.id, orders.planId))
      .where(and(...conditions(f)))
      .orderBy(desc(orders.createdAt))
      .limit(50_000);
    const header = ['Order', 'Status', 'Plan', 'Amount (INR)', 'Method', 'Created (UTC)', 'Paid (UTC)', 'Billing name', 'Email', 'Phone', 'GSTIN'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) =>
        [r.orderNumber, r.status, r.plan, (r.amountPaise / 100).toFixed(2), r.method, r.createdAt, r.paidAt, r.billingName, r.email, r.billingPhone, r.gstin].map(csvCell).join(','),
      ),
    ];
    await logActivity(c, { action: 'orders.export', metadata: { rows: rows.length, filters: f } });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-orders-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  })

  /** Everything about one order: billing snapshot, payments, the access it granted, webhook deliveries and audit trail. */
  .get('/orders/:id', requireStaff('orders.view'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const viewer = (await getUser(c))!;
    const [row] = await db
      .select({ order: orders, plan: { id: plans.id, name: plans.name, slug: plans.slug }, user: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email } })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(plans, eq(plans.id, orders.planId))
      .where(eq(orders.id, c.req.valid('param').id));
    if (!row) throw new AppError('NOT_FOUND', 'Order not found');
    const o = row.order;

    const pays = await db.select().from(payments).where(eq(payments.orderId, o.id)).orderBy(desc(payments.createdAt));
    const payIds = pays.map((p) => p.providerPaymentId);
    const eventMatch = [
      ...(o.providerOrderId ? [sql`json_unquote(json_extract(${paymentWebhookEvents.payload}, '$.payload.payment.entity.order_id')) = ${o.providerOrderId}`] : []),
      ...(payIds.length ? [sql`json_unquote(json_extract(${paymentWebhookEvents.payload}, '$.payload.refund.entity.payment_id')) in (${sql.join(payIds.map((p) => sql`${p}`), sql`, `)})`] : []),
    ];
    const [events, [enrollment], audit] = await Promise.all([
      eventMatch.length
        ? db
            .select({ id: paymentWebhookEvents.id, eventType: paymentWebhookEvents.eventType, status: paymentWebhookEvents.status, error: paymentWebhookEvents.error, createdAt: paymentWebhookEvents.createdAt })
            .from(paymentWebhookEvents)
            .where(or(...eventMatch))
            .orderBy(desc(paymentWebhookEvents.createdAt))
            .limit(50)
        : Promise.resolve([]),
      db.select({ id: enrollments.id, status: enrollments.status, startsAt: enrollments.startsAt, expiresAt: enrollments.expiresAt, revokedAt: enrollments.revokedAt, revokedReason: enrollments.revokedReason }).from(enrollments).where(eq(enrollments.orderId, o.id)),
      db
        .select({ id: activityLogs.id, action: activityLogs.action, metadata: activityLogs.metadata, createdAt: activityLogs.createdAt, actorName: users.firstName, actorRole: activityLogs.actorRole })
        .from(activityLogs)
        .leftJoin(users, eq(users.id, activityLogs.actorId))
        .where(and(eq(activityLogs.entityType, 'order'), eq(activityLogs.entityId, o.id)))
        .orderBy(desc(activityLogs.createdAt))
        .limit(50),
    ]);

    return c.json({
      data: {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        amountPaise: o.amountPaise,
        currency: o.currency,
        providerOrderId: o.providerOrderId,
        createdAt: o.createdAt.toISOString(),
        paidAt: iso(o.paidAt),
        expiresAt: o.expiresAt.toISOString(),
        billing: { name: o.billingName, email: o.billingEmail, phone: o.billingPhone, country: o.billingCountry, gstin: o.gstin },
        student: row.user,
        plan: row.plan,
        payments: pays.map((p) => ({
          id: p.id,
          providerPaymentId: p.providerPaymentId,
          status: p.status,
          method: p.method,
          amountPaise: p.amountPaise,
          refundedPaise: p.refundedPaise,
          errorCode: p.errorCode,
          errorDescription: p.errorDescription,
          capturedAt: iso(p.capturedAt),
          refundedAt: iso(p.refundedAt),
          createdAt: p.createdAt.toISOString(),
        })),
        enrollment: enrollment ? { ...enrollment, startsAt: enrollment.startsAt.toISOString(), expiresAt: iso(enrollment.expiresAt), revokedAt: iso(enrollment.revokedAt) } : null,
        webhookEvents: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
        activity: audit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        refund: refundEligibility(o, viewer.role),
      },
    });
  })

  .post('/orders/:id/refund', requireStaff('orders.refund'), validate('param', idParam), validate('json', z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(500) }).strict()), async (c) => {
    const { db, env } = c.get('deps');
    const actor = (await getUser(c))!;
    const id = c.req.valid('param').id;
    const { reason } = c.req.valid('json');
    const result = await refundOrder(db, env, { orderId: id, actor: { id: actor.id, role: actor.role }, reason });
    await logActivity(c, {
      action: 'order.refund',
      entityType: 'order',
      entityId: id,
      metadata: { orderNumber: result.orderNumber, amountPaise: result.amountPaise, refundId: result.refundId, refundStatus: result.refundStatus, accessRevoked: result.accessRevoked, reason, via: 'admin' },
    });
    return c.json({ data: result });
  })

  .post('/orders/:id/reconcile', requireStaff('orders.refund'), validate('param', idParam), async (c) => {
    const { db, env } = c.get('deps');
    const id = c.req.valid('param').id;
    const { result, activation } = await reconcileOrder(db, env, id);
    await logActivity(c, { action: 'order.reconcile', entityType: 'order', entityId: id, metadata: { result } });
    if (activation?.activated) {
      await logActivity(c, { action: 'order.paid', entityType: 'order', entityId: id, metadata: { orderNumber: activation.order.orderNumber, amountPaise: activation.order.amountPaise, via: 'reconcile' } });
    }
    return c.json({ data: { result } });
  });
