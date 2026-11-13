import { and, eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, notificationJobs, sessions, users, verifications } from './db/schema';
import { INVITE_TTL_MS } from './routes/admin/team';
import { CookieJar, createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('admin team API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let owner: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    owner = await loginAs(ctx, 'super_admin', 'Hitesh');
  });

  const invite = (jar: CookieJar, body: unknown) => postJson(ctx.app, '/admin/team', body, jar);
  const setRole = (jar: CookieJar, id: string, role: string) => sendJson(ctx, 'PATCH', `/admin/team/${id}/role`, { role }, jar);

  it('lists staff only; admins can view but not change the team', async () => {
    const admin = await loginAs(ctx, 'admin', 'Asha');
    await loginAs(ctx, 'student', 'Ravi');
    const { data } = await readJson(await getJson(ctx.app, '/admin/team', admin.jar));
    expect(data.map((m: { firstName: string }) => m.firstName)).toEqual(['Asha', 'Hitesh']);
    expect(data[1]).toMatchObject({ role: 'super_admin', roleLabel: 'Super Admin', status: 'active', sessions: 1 });
    expect((await invite(admin.jar, { email: 'x@example.com', firstName: 'X', role: 'support_manager' })).status).toBe(403);
    expect((await setRole(admin.jar, owner.id, 'student')).status).toBe(403);
    expect((await postJson(ctx.app, `/admin/team/${owner.id}/deactivate`, {}, admin.jar)).status).toBe(403);
    expect((await getJson(ctx.app, '/admin/team', (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
  });

  it('invites a new staff member who sets a password from the email and signs in', async () => {
    const res = await invite(owner.jar, { email: 'Neha@AlphaRecover.com', firstName: 'Neha', role: 'support_manager' });
    expect(res.status).toBe(201);
    const { data } = await readJson(res);
    expect(data.action).toBe('invited');

    const [user] = await ctx.db.select().from(users).where(eq(users.id, data.id));
    expect(user).toMatchObject({ email: 'neha@alpharecover.com', role: 'support_manager', emailVerified: true, lastLoginAt: null });
    expect(await ctx.db.$count(sessions, eq(sessions.userId, data.id))).toBe(0);

    // One invite email, no "verify your email" message.
    const jobs = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.toAddress, 'neha@alpharecover.com'));
    expect(jobs.map((j) => j.template)).toEqual(['staff_invite']);
    const payload = jobs[0].payload as { url: string; invitedBy: string; roleLabel: string };
    expect(payload).toMatchObject({ invitedBy: 'Hitesh', roleLabel: 'Support Manager' });

    const [token] = await ctx.db.select().from(verifications).where(like(verifications.identifier, 'reset-password:%'));
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now() + INVITE_TTL_MS - 60_000);

    // The link works with the normal reset page / endpoint (Better Auth token format).
    const t = new URL(payload.url).searchParams.get('token')!;
    const reset = await postJson(ctx.app, '/auth/password/reset', { token: t, password: 'Neha-Strong-Pass-1', confirmPassword: 'Neha-Strong-Pass-1' });
    expect(reset.status).toBe(200);
    const jar = new CookieJar();
    expect((await postJson(ctx.app, '/auth/login', { email: 'neha@alpharecover.com', password: 'Neha-Strong-Pass-1' }, jar)).status).toBe(200);
    expect((await readJson(await getJson(ctx.app, '/admin/me', jar))).data.role).toBe('support_manager');
    const team = (await readJson(await getJson(ctx.app, '/admin/team', owner.jar))).data;
    expect(team.find((m: { id: string }) => m.id === data.id).invitePending).toBe(false);

    expect((await readJson(await getJson(ctx.app, '/admin/activity?action=team.invite', owner.jar))).data).toHaveLength(1);
  });

  it('refuses duplicates, promotes an existing student, and resends pending invites only', async () => {
    const member = await loginAs(ctx, 'content_manager', 'Kiran');
    const dup = await invite(owner.jar, { email: member.email, firstName: 'Kiran', role: 'admin' });
    expect(dup.status).toBe(409);

    const student = await loginAs(ctx, 'student', 'Ravi');
    const promoted = await readJson(await invite(owner.jar, { email: student.email, firstName: 'Ravi', role: 'content_manager' }));
    expect(promoted.data).toEqual({ id: student.id, action: 'promoted' });
    expect((await getJson(ctx.app, '/me', student.jar)).status).toBe(401); // signed out by the role change

    const fresh = (await readJson(await invite(owner.jar, { email: 'new@example.com', firstName: 'New', role: 'finance_manager' }))).data;
    expect((await postJson(ctx.app, `/admin/team/${fresh.id}/resend-invite`, {}, owner.jar)).status).toBe(200);
    // Only the latest invite link stays valid.
    expect(await ctx.db.$count(verifications, and(eq(verifications.value, fresh.id), like(verifications.identifier, 'reset-password:%')))).toBe(1);
    await ctx.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, member.id));
    expect((await postJson(ctx.app, `/admin/team/${member.id}/resend-invite`, {}, owner.jar)).status).toBe(422);
    expect((await invite(owner.jar, { email: 'bad', firstName: 'B', role: 'support_manager' })).status).toBe(400);
    expect((await invite(owner.jar, { email: 'a@b.co', firstName: 'B', role: 'student' })).status).toBe(400);
  });

  it('changes roles (signing the member out) and protects self and the last super admin', async () => {
    const member = await loginAs(ctx, 'support_manager', 'Neha');
    const res = await setRole(owner.jar, member.id, 'admin');
    expect(res.status).toBe(200);
    expect((await getJson(ctx.app, '/admin/me', member.jar)).status).toBe(401);
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'team.role_change'));
    expect(log.metadata).toEqual({ from: 'support_manager', to: 'admin' });

    expect((await setRole(owner.jar, owner.id, 'admin')).status).toBe(422);
    expect((await postJson(ctx.app, `/admin/team/${owner.id}/deactivate`, {}, owner.jar)).status).toBe(422);

    // Removing access: role → student
    expect((await setRole(owner.jar, member.id, 'student')).status).toBe(200);
    expect((await readJson(await getJson(ctx.app, '/admin/team', owner.jar))).data.map((m: { id: string }) => m.id)).not.toContain(member.id);
    expect((await setRole(owner.jar, member.id, 'admin')).status).toBe(404); // students aren't team members
  });

  it('lets one super admin demote another while at least one stays', async () => {
    const second = await loginAs(ctx, 'super_admin', 'Second');
    expect((await setRole(second.jar, owner.id, 'admin')).status).toBe(200);
    const supers = (await readJson(await getJson(ctx.app, '/admin/team', second.jar))).data.filter((m: { role: string }) => m.role === 'super_admin');
    expect(supers.map((m: { id: string }) => m.id)).toEqual([second.id]);
    // The remaining one can't demote or deactivate themselves.
    expect((await setRole(second.jar, second.id, 'admin')).status).toBe(422);
    expect((await postJson(ctx.app, `/admin/team/${second.id}/deactivate`, {}, second.jar)).status).toBe(422);
  });

  it('deactivates and reactivates, revoking sessions', async () => {
    const member = await loginAs(ctx, 'content_manager', 'Kiran');
    expect((await postJson(ctx.app, `/admin/team/${member.id}/deactivate`, {}, owner.jar)).status).toBe(200);
    expect(await ctx.db.$count(sessions, eq(sessions.userId, member.id))).toBe(0);
    const [row] = await ctx.db.select().from(users).where(eq(users.id, member.id));
    expect(row.status).toBe('suspended');
    expect((await postJson(ctx.app, `/admin/team/${member.id}/reactivate`, {}, owner.jar)).status).toBe(200);
    const actions = (await ctx.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
    expect(actions).toEqual(expect.arrayContaining(['team.deactivate', 'team.reactivate']));
  });
});
