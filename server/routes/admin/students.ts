import { and, asc, count, desc, eq, exists, gt, isNull, like, notExists, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { REGISTER_COUNTRIES } from '../../../shared/countries';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { certificates, enrollments, plans, sessions, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { maskEmail, maskPhone } from '../../lib/mask';
import { describeDevice } from '../../lib/userAgent';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';
import { profileUpdate } from '../me';

const countryCodes = REGISTER_COUNTRIES.map((c) => c.code) as [string, ...string[]];

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  country: z.enum(countryCodes).optional(),
  enrolled: z.enum(['yes', 'no']).optional(),
  verified: z.enum(['yes', 'no']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['-createdAt', 'createdAt', 'name', '-lastLoginAt']).default('-createdAt'),
});

const idParam = z.object({ id: z.uuid() });

/** Staff accounts are managed in Team & Access, so this module only ever touches students. */
async function loadStudent(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, 'student'), isNull(users.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Student not found');
  return row;
}

/** Students admin module (docs/admin/NAVIGATION.md §3). */
export const adminStudentRoutes = new Hono<AppEnv>()
  .get('/students', requireStaff('students.view'), validate('query', listQuery), async (c) => {
    const q = c.req.valid('query');
    const { db } = c.get('deps');
    const enrolledSub = db
      .select({ one: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, users.id), eq(enrollments.status, 'active')));

    const where: SQL[] = [eq(users.role, 'student'), isNull(users.deletedAt)];
    if (q.status) where.push(eq(users.status, q.status));
    if (q.country) where.push(eq(users.country, q.country));
    if (q.verified) where.push(eq(users.emailVerified, q.verified === 'yes'));
    if (q.enrolled === 'yes') where.push(exists(enrolledSub));
    if (q.enrolled === 'no') where.push(notExists(enrolledSub));
    if (q.q) {
      const term = `%${q.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      const digits = q.q.replace(/\D/g, '');
      const parts = [like(users.firstName, term), like(users.lastName, term), like(users.email, term)];
      if (digits.length >= 4) parts.push(like(users.phone, `%${digits}%`));
      where.push(or(...parts)!);
    }
    const order =
      q.sort === 'createdAt' ? asc(users.createdAt) : q.sort === 'name' ? asc(users.firstName) : q.sort === '-lastLoginAt' ? desc(users.lastLoginAt) : desc(users.createdAt);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phone: users.phone,
          country: users.country,
          status: users.status,
          emailVerified: users.emailVerified,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          enrolled: exists(enrolledSub).mapWith(Boolean),
        })
        .from(users)
        .where(and(...where))
        .orderBy(order, desc(users.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ total: count() })
        .from(users)
        .where(and(...where)),
    ]);

    return c.json({
      data: rows.map((r) => ({
        ...r,
        email: maskEmail(r.email),
        phone: maskPhone(r.phone),
        lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: Number(total) },
    });
  })

  .get('/students/:id', requireStaff('students.view'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const s = await loadStudent(db, c.req.valid('param').id);
    const [enrollmentRows, certificateRows, sessionRows] = await Promise.all([
      db
        .select({
          id: enrollments.id,
          plan: plans.name,
          source: enrollments.source,
          status: enrollments.status,
          startsAt: enrollments.startsAt,
          expiresAt: enrollments.expiresAt,
          revokedReason: enrollments.revokedReason,
        })
        .from(enrollments)
        .innerJoin(plans, eq(plans.id, enrollments.planId))
        .where(eq(enrollments.userId, s.id))
        .orderBy(desc(enrollments.startsAt)),
      db
        .select({ id: certificates.id, code: certificates.code, programTitle: certificates.programTitle, status: certificates.status, issuedAt: certificates.issuedAt })
        .from(certificates)
        .where(eq(certificates.userId, s.id))
        .orderBy(desc(certificates.issuedAt)),
      db
        .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(and(eq(sessions.userId, s.id), gt(sessions.expiresAt, new Date())))
        .orderBy(desc(sessions.updatedAt)),
    ]);
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    return c.json({
      data: {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        certificateName: s.certificateName,
        email: s.email,
        emailVerified: s.emailVerified,
        phone: s.phone,
        country: s.country,
        status: s.status,
        whatsappOptIn: s.whatsappOptInAt !== null,
        lastLoginAt: iso(s.lastLoginAt),
        createdAt: s.createdAt.toISOString(),
        enrollments: enrollmentRows.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), expiresAt: iso(e.expiresAt) })),
        certificates: certificateRows.map((x) => ({ ...x, issuedAt: x.issuedAt.toISOString() })),
        // Device only: the raw IP stays out of the admin UI.
        sessions: sessionRows.map((x) => ({ id: x.id, device: describeDevice(x.userAgent), signedInAt: x.createdAt.toISOString(), lastActiveAt: x.updatedAt.toISOString() })),
      },
    });
  })

  .patch(
    '/students/:id',
    requireStaff('students.edit'),
    validate('param', idParam),
    validate('json', profileUpdate.omit({ whatsappOptIn: true })),
    async (c) => {
      const { db } = c.get('deps');
      const s = await loadStudent(db, c.req.valid('param').id);
      const input = c.req.valid('json');
      const changes = Object.fromEntries(Object.entries(input).filter(([k, v]) => v !== undefined && v !== s[k as keyof typeof s]));
      if (Object.keys(changes).length) {
        await db.update(users).set(changes).where(eq(users.id, s.id));
        const before = Object.fromEntries(Object.keys(changes).map((k) => [k, s[k as keyof typeof s]]));
        await logActivity(c, { action: 'students.update', entityType: 'user', entityId: s.id, metadata: { before, after: changes } });
      }
      return c.json({ data: { ok: true, changed: Object.keys(changes) } });
    },
  )

  .post(
    '/students/:id/suspend',
    requireStaff('students.edit'),
    validate('param', idParam),
    validate('json', z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(500) })),
    async (c) => {
      const { db } = c.get('deps');
      const s = await loadStudent(db, c.req.valid('param').id);
      const { reason } = c.req.valid('json');
      if (s.status === 'suspended') return c.json({ data: { ok: true, status: 'suspended' } });
      await db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'suspended' }).where(eq(users.id, s.id));
        await tx.delete(sessions).where(eq(sessions.userId, s.id));
      });
      await logActivity(c, { action: 'students.suspend', entityType: 'user', entityId: s.id, metadata: { reason } });
      return c.json({ data: { ok: true, status: 'suspended' } });
    },
  )

  .post('/students/:id/unsuspend', requireStaff('students.edit'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const s = await loadStudent(db, c.req.valid('param').id);
    if (s.status === 'suspended') {
      await db.update(users).set({ status: 'active' }).where(eq(users.id, s.id));
      await logActivity(c, { action: 'students.unsuspend', entityType: 'user', entityId: s.id });
    }
    return c.json({ data: { ok: true, status: 'active' } });
  })

  .post('/students/:id/sessions/revoke', requireStaff('students.edit'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const s = await loadStudent(db, c.req.valid('param').id);
    const live = await db.select({ n: count() }).from(sessions).where(eq(sessions.userId, s.id));
    await db.delete(sessions).where(eq(sessions.userId, s.id));
    await logActivity(c, { action: 'students.sessions_revoke', entityType: 'user', entityId: s.id, metadata: { sessions: Number(live[0].n) } });
    return c.json({ data: { ok: true, revoked: Number(live[0].n) } });
  })

  .post('/students/:id/password-reset', requireStaff('students.edit'), validate('param', idParam), async (c) => {
    const { db, auth, env } = c.get('deps');
    const s = await loadStudent(db, c.req.valid('param').id);
    if (s.status !== 'active') throw new AppError('BUSINESS_RULE', 'Unsuspend the account before sending a reset link');
    await auth.api.requestPasswordReset({ body: { email: s.email, redirectTo: `${env.APP_URL}/reset-password` } });
    await logActivity(c, { action: 'students.password_reset', entityType: 'user', entityId: s.id });
    return c.json({ data: { ok: true } });
  });
