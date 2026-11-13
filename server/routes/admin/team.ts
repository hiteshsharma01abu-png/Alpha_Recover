import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { ROLE_LABELS, USER_ROLES, isStaff } from '../../../shared/permissions';
import type { StaffRole, UserRole } from '../../../shared/permissions';
import { logActivity } from '../../audit';
import { getUser, requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { notificationJobs, sessions, users, verifications } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { validate } from '../../lib/validate';
import { enqueueEmail } from '../../notifications/outbox';
import type { AppEnv } from '../../types';

const STAFF_ROLES = USER_ROLES.filter((r): r is StaffRole => isStaff(r)) as [StaffRole, ...StaffRole[]];
export const INVITE_TTL_MS = 3 * 86_400_000;
const idParam = z.object({ id: z.uuid() });

/**
 * Invite link = a Better Auth password-reset token with a longer life (3 days instead of 1 hour),
 * stored in the format Better Auth reads (`reset-password:<token>` → user id). The invite test
 * sets a password through /auth/password/reset, so a format change in an upgrade fails CI.
 */
async function sendInvite(c: Context<AppEnv>, user: { id: string; email: string; firstName: string; role: StaffRole }) {
  const { db, env } = c.get('deps');
  const inviter = (await getUser(c))!;
  const token = randomBytes(18).toString('base64url');
  await db.delete(verifications).where(and(eq(verifications.value, user.id), sql`${verifications.identifier} like 'reset-password:%'`));
  await db.insert(verifications).values({ identifier: `reset-password:${token}`, value: user.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) });
  await enqueueEmail(db, 'staff_invite', user.email, {
    firstName: user.firstName,
    invitedBy: inviter.firstName,
    roleLabel: ROLE_LABELS[user.role],
    url: `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
  });
}

async function loadStaff(db: Database, id: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role, status: users.status, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));
  if (!row || !isStaff(row.role)) throw new AppError('NOT_FOUND', 'Team member not found');
  return row;
}

/**
 * At least one active Super Admin must always remain (docs/admin/AUTH_AND_RBAC.md §2). Through the API
 * the actor is itself an active Super Admin and can't target itself, so this is a safety net (e.g. if
 * role changes are later opened to other roles).
 */
async function assertNotLastSuperAdmin(db: Database, target: { id: string; role: UserRole; status: string }) {
  if (target.role !== 'super_admin' || target.status !== 'active') return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'), isNull(users.deletedAt), ne(users.id, target.id)));
  if (Number(n) === 0) throw new AppError('BUSINESS_RULE', 'This is the only active Super Admin. Make someone else Super Admin first.');
}

function assertNotSelf(c: Context<AppEnv>, targetId: string, what: string) {
  if (c.get('user')?.id === targetId) throw new AppError('BUSINESS_RULE', `You can't ${what} your own account`);
}

/** Team & Access admin module: staff accounts, invites, roles, deactivation. */
export const adminTeamRoutes = new Hono<AppEnv>()
  .get('/team', requireStaff('team.view'), async (c) => {
    const { db } = c.get('deps');
    const liveSessions = db
      .select({ n: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, users.id), gt(sessions.expiresAt, new Date())));
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        sessions: sql<number>`(${liveSessions})`.mapWith(Number),
      })
      .from(users)
      .where(and(ne(users.role, 'student'), isNull(users.deletedAt)))
      .orderBy(asc(users.firstName));
    return c.json({
      data: rows.map((r) => ({
        ...r,
        roleLabel: ROLE_LABELS[r.role],
        // Never signed in yet = the invite hasn't been used.
        invitePending: r.lastLoginAt === null,
        lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  })

  .post(
    '/team',
    requireStaff('team.add'),
    validate(
      'json',
      z
        .object({
          email: z.email('Enter a valid email').trim().toLowerCase().max(254),
          firstName: z.string().trim().min(1, 'Enter a first name').max(80),
          role: z.enum(STAFF_ROLES),
        })
        .strict(),
    ),
    async (c) => {
      const { db, auth } = c.get('deps');
      const input = c.req.valid('json');
      const [existing] = await db.select().from(users).where(eq(users.email, input.email));

      if (existing && !existing.deletedAt) {
        if (isStaff(existing.role)) {
          throw new AppError('CONFLICT', 'This person is already on the team', { details: [{ path: 'email', message: 'Already a team member' }] });
        }
        // A student account becomes staff: same login, new role, signed out everywhere.
        await db.transaction(async (tx) => {
          await tx.update(users).set({ role: input.role }).where(eq(users.id, existing.id));
          await tx.delete(sessions).where(eq(sessions.userId, existing.id));
        });
        await logActivity(c, { action: 'team.role_change', entityType: 'user', entityId: existing.id, metadata: { from: existing.role, to: input.role, via: 'invite' } });
        return c.json({ data: { id: existing.id, action: 'promoted' } }, 201);
      }
      if (existing) throw new AppError('CONFLICT', 'This email belonged to a deleted account. Restore it from the database first.');

      // Unusable random password: the invitee sets their own through the invite link.
      const res = await auth.api.signUpEmail({
        body: { email: input.email, password: randomBytes(24).toString('base64url'), name: input.firstName, country: 'IN', termsAcceptedAt: new Date() },
      });
      const id = res.user.id;
      await db.transaction(async (tx) => {
        await tx.update(users).set({ role: input.role, emailVerified: true }).where(eq(users.id, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));
        // Sign-up queued a "verify your email" message; the invite replaces it.
        await tx.delete(notificationJobs).where(and(eq(notificationJobs.toAddress, input.email), eq(notificationJobs.template, 'verify_email'), eq(notificationJobs.status, 'pending')));
      });
      await sendInvite(c, { id, email: input.email, firstName: input.firstName, role: input.role });
      await logActivity(c, { action: 'team.invite', entityType: 'user', entityId: id, metadata: { email: input.email, role: input.role } });
      return c.json({ data: { id, action: 'invited' } }, 201);
    },
  )

  .post('/team/:id/resend-invite', requireStaff('team.add'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const m = await loadStaff(db, c.req.valid('param').id);
    if (m.lastLoginAt) throw new AppError('BUSINESS_RULE', 'This person has already signed in. They can use "Forgot password" instead.');
    if (m.status !== 'active') throw new AppError('BUSINESS_RULE', 'Reactivate the account before sending a new invite');
    await sendInvite(c, { ...m, role: m.role as StaffRole });
    await logActivity(c, { action: 'team.invite_resend', entityType: 'user', entityId: m.id });
    return c.json({ data: { ok: true } });
  })

  .patch(
    '/team/:id/role',
    requireStaff('team.manage_roles'),
    validate('param', idParam),
    validate('json', z.object({ role: z.enum(USER_ROLES) }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const m = await loadStaff(db, c.req.valid('param').id);
      const { role } = c.req.valid('json');
      assertNotSelf(c, m.id, 'change the role of');
      if (role === m.role) return c.json({ data: { id: m.id, role } });
      if (m.role === 'super_admin') await assertNotLastSuperAdmin(db, m);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ role }).where(eq(users.id, m.id));
        await tx.delete(sessions).where(eq(sessions.userId, m.id)); // new permissions → sign in again
      });
      await logActivity(c, { action: role === 'student' ? 'team.remove' : 'team.role_change', entityType: 'user', entityId: m.id, metadata: { from: m.role, to: role } });
      return c.json({ data: { id: m.id, role } });
    },
  )

  .post('/team/:id/deactivate', requireStaff('team.edit'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const m = await loadStaff(db, c.req.valid('param').id);
    assertNotSelf(c, m.id, 'deactivate');
    if (m.status === 'active') {
      await assertNotLastSuperAdmin(db, m);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'suspended' }).where(eq(users.id, m.id));
        await tx.delete(sessions).where(eq(sessions.userId, m.id));
      });
      await logActivity(c, { action: 'team.deactivate', entityType: 'user', entityId: m.id });
    }
    return c.json({ data: { id: m.id, status: 'suspended' } });
  })

  .post('/team/:id/reactivate', requireStaff('team.edit'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const m = await loadStaff(db, c.req.valid('param').id);
    if (m.status !== 'active') {
      await db.update(users).set({ status: 'active' }).where(eq(users.id, m.id));
      await logActivity(c, { action: 'team.reactivate', entityType: 'user', entityId: m.id });
    }
    return c.json({ data: { id: m.id, status: 'active' } });
  });
