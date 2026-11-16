import { and, asc, count, desc, eq, gt, isNull, like, lte, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { enrollments, plans, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { csvCell, maskEmail } from '../../lib/mask';
import { validate } from '../../lib/validate';
import { grantEnrollment, revokeEnrollment } from '../../services/enrollments';
import type { AppEnv } from '../../types';

const STATUSES = ['active', 'expired', 'revoked'] as const;
type Status = (typeof STATUSES)[number];

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const filters = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  source: z.enum(['purchase', 'manual', 'complimentary']).optional(),
  planId: z.uuid().optional(),
  userId: z.uuid().optional(),
});
type Filters = z.infer<typeof filters>;

const idParam = z.object({ id: z.uuid() });
const reason = z.string().trim().min(3, 'Give a short reason').max(500);

/** Access ends at the end of the chosen day, India time. */
const endOfIstDay = (d: string) => new Date(`${d}T23:59:59.999+05:30`);

function futureEnd(d: string, now = new Date()) {
  const end = endOfIstDay(d);
  if (Number.isNaN(end.getTime()) || end <= now) throw new AppError('VALIDATION_ERROR', 'Choose a date in the future', { details: [{ path: 'expiresOn', message: 'Choose a date in the future' }] });
  return end;
}

/**
 * Status as staff should see it: an active row past its end date is expired even before the
 * maintenance cron flips it (access checks already use expires_at).
 */
function statusCondition(status: Status, now: Date): SQL {
  if (status === 'revoked') return eq(enrollments.status, 'revoked');
  const ended = and(eq(enrollments.status, 'active'), lte(enrollments.expiresAt, now))!;
  if (status === 'expired') return or(eq(enrollments.status, 'expired'), ended)!;
  return and(eq(enrollments.status, 'active'), or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, now)))!;
}

const displayStatus = (r: { status: string; expiresAt: Date | null }, now: Date): Status =>
  r.status === 'active' && r.expiresAt && r.expiresAt <= now ? 'expired' : (r.status as Status);

function conditions(f: Filters): SQL[] {
  const where: SQL[] = [];
  if (f.source) where.push(eq(enrollments.source, f.source));
  if (f.planId) where.push(eq(enrollments.planId, f.planId));
  if (f.userId) where.push(eq(enrollments.userId, f.userId));
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(or(like(users.firstName, term), like(users.lastName, term), like(users.email, term))!);
  }
  return where;
}

const grantedBy = alias(users, 'granted_by_user');
const columns = {
  id: enrollments.id,
  userId: enrollments.userId,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  planId: enrollments.planId,
  plan: plans.name,
  source: enrollments.source,
  status: enrollments.status,
  orderId: enrollments.orderId,
  startsAt: enrollments.startsAt,
  expiresAt: enrollments.expiresAt,
  revokedAt: enrollments.revokedAt,
  revokedReason: enrollments.revokedReason,
  grantedById: grantedBy.id,
  grantedByName: grantedBy.firstName,
};

async function loadEnrollment(db: Database, id: string) {
  const [row] = await db.select().from(enrollments).where(eq(enrollments.id, id));
  if (!row) throw new AppError('NOT_FOUND', 'Enrollment not found');
  return row;
}

/** Enrollments admin module (docs/admin/NAVIGATION.md §3): who has course access, manual grants, revokes. */
export const adminEnrollmentRoutes = new Hono<AppEnv>()
  .get(
    '/enrollments',
    requireStaff('enrollments.view'),
    validate('query', filters.extend({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) })),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const now = new Date();
      const base = conditions(q);
      const where = and(...base, ...(q.status ? [statusCondition(q.status, now)] : []));
      const countFor = (s: Status) =>
        db
          .select({ n: count() })
          .from(enrollments)
          .innerJoin(users, eq(users.id, enrollments.userId))
          .where(and(...base, statusCondition(s, now)))
          .then(([r]) => Number(r.n));

      const [rows, [{ total }], ...counts] = await Promise.all([
        db
          .select(columns)
          .from(enrollments)
          .innerJoin(users, eq(users.id, enrollments.userId))
          .innerJoin(plans, eq(plans.id, enrollments.planId))
          .leftJoin(grantedBy, eq(grantedBy.id, enrollments.grantedBy))
          .where(where)
          .orderBy(desc(enrollments.startsAt), desc(enrollments.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).where(where),
        ...STATUSES.map(countFor),
      ]);

      const iso = (d: Date | null) => d?.toISOString() ?? null;
      return c.json({
        data: rows.map(({ firstName, lastName, email, grantedById, grantedByName, ...r }) => ({
          ...r,
          status: displayStatus(r, now),
          student: { id: r.userId, firstName, lastName, email: maskEmail(email) },
          grantedBy: grantedById ? { id: grantedById, firstName: grantedByName } : null,
          startsAt: r.startsAt.toISOString(),
          expiresAt: iso(r.expiresAt),
          revokedAt: iso(r.revokedAt),
        })),
        meta: {
          page: q.page,
          pageSize: q.pageSize,
          total: Number(total),
          counts: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]])) as Record<Status, number>,
        },
      });
    },
  )

  /** Plans for the filter and the grant dialog (drafts included: staff may grant before launch). */
  .get('/enrollments/plans', requireStaff('enrollments.view'), async (c) => {
    const { db } = c.get('deps');
    const rows = await db
      .select({ id: plans.id, name: plans.name, status: plans.status, accessDays: plans.accessDays })
      .from(plans)
      .where(isNull(plans.deletedAt))
      .orderBy(asc(plans.sortOrder), asc(plans.name));
    return c.json({ data: rows });
  })

  .get('/enrollments/export.csv', requireStaff('enrollments.export'), validate('query', filters), async (c) => {
    const f = c.req.valid('query');
    const { db } = c.get('deps');
    const now = new Date();
    const MAX = 50_000;
    const rows = await db
      .select(columns)
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(plans, eq(plans.id, enrollments.planId))
      .leftJoin(grantedBy, eq(grantedBy.id, enrollments.grantedBy))
      .where(and(...conditions(f), ...(f.status ? [statusCondition(f.status, now)] : [])))
      .orderBy(desc(enrollments.startsAt), desc(enrollments.id))
      .limit(MAX);
    const header = ['Student', 'Email', 'Plan', 'Source', 'Status', 'Starts (UTC)', 'Ends (UTC)', 'Revoked (UTC)', 'Revoke reason', 'Granted by', 'Order id'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) =>
        [
          [r.firstName, r.lastName].filter(Boolean).join(' '),
          r.email,
          r.plan,
          r.source,
          displayStatus(r, now),
          r.startsAt,
          r.expiresAt ?? 'lifetime',
          r.revokedAt,
          r.revokedReason,
          r.grantedByName,
          r.orderId,
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    await logActivity(c, { action: 'enrollments.export', metadata: { rows: rows.length, filters: f } });
    const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-enrollments-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  })

  /**
   * Manual / complimentary grant. `expiresOn` omitted = the plan's default access period;
   * null = lifetime; a date = access until the end of that day (IST).
   */
  .post(
    '/enrollments',
    requireStaff('enrollments.add'),
    validate(
      'json',
      z.object({
        userId: z.uuid(),
        planId: z.uuid(),
        source: z.enum(['manual', 'complimentary']),
        expiresOn: ymd.nullable().optional(),
        reason,
      }),
    ),
    async (c) => {
      const input = c.req.valid('json');
      const { db } = c.get('deps');
      const now = new Date();
      const [student] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.role, 'student'), isNull(users.deletedAt)));
      if (!student) throw new AppError('NOT_FOUND', 'Student not found');
      const [plan] = await db.select().from(plans).where(and(eq(plans.id, input.planId), isNull(plans.deletedAt)));
      if (!plan) throw new AppError('NOT_FOUND', 'Plan not found');

      const expiresAt =
        input.expiresOn === undefined
          ? plan.accessDays
            ? new Date(now.getTime() + plan.accessDays * 86_400_000)
            : null
          : input.expiresOn === null
            ? null
            : futureEnd(input.expiresOn, now);

      // An active row past its end date would block the grant until the cron runs: close it first.
      await db
        .update(enrollments)
        .set({ status: 'expired' })
        .where(and(eq(enrollments.userId, student.id), eq(enrollments.planId, plan.id), eq(enrollments.status, 'active'), lte(enrollments.expiresAt, now)));

      const { enrollment, created } = await grantEnrollment(db, { userId: student.id, planId: plan.id, source: input.source, expiresAt, grantedBy: c.get('user')!.id });
      if (!created) throw new AppError('CONFLICT', `This student already has active access to ${plan.name}. Change its end date instead.`);

      await logActivity(c, {
        action: 'enrollments.grant',
        entityType: 'enrollment',
        entityId: enrollment.id,
        metadata: { userId: student.id, plan: plan.name, source: input.source, expiresAt: expiresAt?.toISOString() ?? null, reason: input.reason },
      });
      return c.json({ data: { id: enrollment.id, expiresAt: expiresAt?.toISOString() ?? null } }, 201);
    },
  )

  /** Extend or shorten access (null = lifetime). Only active enrollments. */
  .patch(
    '/enrollments/:id',
    requireStaff('enrollments.edit'),
    validate('param', idParam),
    validate('json', z.object({ expiresOn: ymd.nullable() })),
    async (c) => {
      const { db } = c.get('deps');
      const e = await loadEnrollment(db, c.req.valid('param').id);
      if (e.status !== 'active') throw new AppError('BUSINESS_RULE', `This enrollment is ${e.status}. Grant access again instead.`);
      const { expiresOn } = c.req.valid('json');
      const expiresAt = expiresOn === null ? null : futureEnd(expiresOn);
      await db.update(enrollments).set({ expiresAt }).where(eq(enrollments.id, e.id));
      await logActivity(c, {
        action: 'enrollments.update',
        entityType: 'enrollment',
        entityId: e.id,
        metadata: { userId: e.userId, before: { expiresAt: e.expiresAt?.toISOString() ?? null }, after: { expiresAt: expiresAt?.toISOString() ?? null } },
      });
      return c.json({ data: { id: e.id, expiresAt: expiresAt?.toISOString() ?? null } });
    },
  )

  .post('/enrollments/:id/revoke', requireStaff('enrollments.revoke'), validate('param', idParam), validate('json', z.object({ reason })), async (c) => {
    const { db } = c.get('deps');
    const e = await loadEnrollment(db, c.req.valid('param').id);
    const { reason: why } = c.req.valid('json');
    if (!(await revokeEnrollment(db, e.id, why))) throw new AppError('BUSINESS_RULE', `This enrollment is already ${e.status}.`);
    await logActivity(c, { action: 'enrollments.revoke', entityType: 'enrollment', entityId: e.id, metadata: { userId: e.userId, source: e.source, reason: why } });
    return c.json({ data: { id: e.id, status: 'revoked' } });
  });
