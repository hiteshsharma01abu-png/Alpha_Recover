import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { REGISTER_COUNTRIES } from '../../shared/countries';
import { logActivity } from '../audit';
import { getUser, requireUser } from '../auth/middleware';
import { courses, enrollments, plans, sessions, users } from '../db/schema';
import { AppError } from '../lib/errors';
import { normalizePhone } from '../lib/phone';
import { describeDevice } from '../lib/userAgent';
import { canAccessCourse } from '../services/enrollments';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';

const countryCodes = REGISTER_COUNTRIES.map((c) => c.code) as [string, ...string[]];
const optionalName = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Only these fields can be changed here: never email, role or status. */
export const profileUpdate = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name').max(80).optional(),
    lastName: optionalName(80),
    certificateName: optionalName(160),
    country: z.enum(countryCodes).optional(),
    phone: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v, ctx) => {
        if (v === undefined) return undefined;
        if (!v) return null;
        const n = normalizePhone(v);
        if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
        return n;
      }),
    whatsappOptIn: z.boolean().optional(),
  })
  .strict();

const profileColumns = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  certificateName: users.certificateName,
  phone: users.phone,
  country: users.country,
  role: users.role,
  emailVerified: users.emailVerified,
  whatsappOptInAt: users.whatsappOptInAt,
  createdAt: users.createdAt,
};

async function loadProfile(db: AppEnv['Variables']['deps']['db'], userId: string) {
  const [p] = await db.select(profileColumns).from(users).where(eq(users.id, userId));
  const { whatsappOptInAt, ...rest } = p;
  return { ...rest, whatsappOptIn: Boolean(whatsappOptInAt), createdAt: p.createdAt.toISOString() };
}

/** /me — the signed-in user's own profile and devices (docs/API.md §3). */
export const meRoutes = new Hono<AppEnv>()
  .use('/me', requireUser())
  .use('/me/*', requireUser())

  .get('/me', async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ data: await loadProfile(c.get('deps').db, (await getUser(c))!.id) });
  })

  .patch('/me', validate('json', profileUpdate), async (c) => {
    const input = c.req.valid('json');
    const { db } = c.get('deps');
    const user = (await getUser(c))!;
    const before = await loadProfile(db, user.id);
    const { whatsappOptIn, ...fields } = input;
    const set: Partial<typeof users.$inferInsert> = { ...fields };
    if (whatsappOptIn !== undefined) set.whatsappOptInAt = whatsappOptIn ? (before.whatsappOptIn ? undefined : new Date()) : null;
    const changes = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      await db.update(users).set(changes).where(eq(users.id, user.id));
      await logActivity(c, {
        action: 'user.update_profile',
        entityType: 'user',
        entityId: user.id,
        metadata: { fields: Object.keys(input) },
      });
    }
    return c.json({ data: await loadProfile(db, user.id) });
  })

  .get('/me/sessions', async (c) => {
    c.header('Cache-Control', 'no-store');
    const user = (await getUser(c))!;
    const rows = await c
      .get('deps')
      .db.select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.updatedAt));
    const current = c.get('sessionId');
    return c.json({
      data: rows.map((s) => ({
        id: s.id,
        device: describeDevice(s.userAgent),
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.updatedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        current: s.id === current,
      })),
    });
  })

  /** Your enrollments, newest first (docs/API.md §3, §6). */
  .get('/me/enrollments', async (c) => {
    c.header('Cache-Control', 'no-store');
    const user = (await getUser(c))!;
    const rows = await c
      .get('deps')
      .db.select({
        id: enrollments.id,
        status: enrollments.status,
        source: enrollments.source,
        startsAt: enrollments.startsAt,
        expiresAt: enrollments.expiresAt,
        planSlug: plans.slug,
        planName: plans.name,
      })
      .from(enrollments)
      .innerJoin(plans, eq(plans.id, enrollments.planId))
      .where(eq(enrollments.userId, user.id))
      .orderBy(desc(enrollments.startsAt));
    const now = Date.now();
    return c.json({
      data: rows.map((r) => ({
        ...r,
        // An active row past its end date is effectively expired, even before the cron marks it.
        status: r.status === 'active' && r.expiresAt && r.expiresAt.getTime() <= now ? 'expired' : r.status,
        startsAt: r.startsAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
      })),
    });
  })

  /** Quick check for the UI: can I open this course? */
  .get('/me/access/courses/:slug', validate('param', z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) })), async (c) => {
    c.header('Cache-Control', 'no-store');
    const user = (await getUser(c))!;
    const { db } = c.get('deps');
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, c.req.valid('param').slug), isNull(courses.deletedAt)));
    if (!course) throw new AppError('NOT_FOUND', 'Course not found');
    return c.json({ data: { enrolled: await canAccessCourse(db, user.id, course.id) } });
  })

  .delete('/me/sessions/:id', validate('param', z.object({ id: z.uuid() })), async (c) => {
    const user = (await getUser(c))!;
    const { db } = c.get('deps');
    const { id } = c.req.valid('param');
    // Scoped to the signed-in user: someone else's session id is simply "not found".
    const [row] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
    if (!row) throw new AppError('NOT_FOUND', 'Session not found');
    await db.delete(sessions).where(eq(sessions.id, id));
    await logActivity(c, { action: 'auth.session_revoke', entityType: 'session', entityId: id });
    return c.json({ data: { ok: true, current: id === c.get('sessionId') } });
  });
