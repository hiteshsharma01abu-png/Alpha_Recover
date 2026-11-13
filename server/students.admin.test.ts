import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, notificationJobs, plans, sessions, users } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { grantEnrollment } from './services/enrollments';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('admin students API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let ravi: Awaited<ReturnType<typeof loginAs>>;
  let meena: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedCatalog(ctx.db);
    await seedPlans(ctx.db);
    ravi = await loginAs(ctx, 'student', 'Ravi');
    meena = await loginAs(ctx, 'student', 'Meena');
    await ctx.db.update(users).set({ phone: '+919812345678', country: 'IN' }).where(eq(users.id, ravi.id));
    await ctx.db.update(users).set({ country: 'AE' }).where(eq(users.id, meena.id));
    const [plan] = await ctx.db.select().from(plans);
    await grantEnrollment(ctx.db, { userId: ravi.id, planId: plan.id, source: 'manual' });
  });

  const ids = (body: { data: { id: string }[] }) => body.data.map((s) => s.id);

  it('is open to support (view+edit) and finance (view) but not content managers; staff never appear', async () => {
    const support = await loginAs(ctx, 'support_manager');
    const body = await readJson(await getJson(ctx.app, '/admin/students', support.jar));
    expect(ids(body).sort()).toEqual([ravi.id, meena.id].sort());
    expect((await getJson(ctx.app, '/admin/students', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(200);
    expect((await getJson(ctx.app, '/admin/students', (await loginAs(ctx, 'content_manager')).jar)).status).toBe(403);
    // A staff id is "not found" here: Team & Access manages staff.
    expect((await getJson(ctx.app, `/admin/students/${support.id}`, support.jar)).status).toBe(404);
  });

  it('masks contact details in the list and filters by enrolled, country, status and search', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const list = async (qs: string) => readJson(await getJson(ctx.app, `/admin/students?${qs}`, jar));
    const all = await list('');
    const r = all.data.find((s: { id: string }) => s.id === ravi.id);
    expect(r).toMatchObject({ firstName: 'Ravi', phone: '+91 ••••• 45678', enrolled: true, status: 'active' });
    expect(r.email).toMatch(/^st\*\*\*@example\.com$/);
    expect(all.meta.total).toBe(2);
    expect(ids(await list('enrolled=yes'))).toEqual([ravi.id]);
    expect(ids(await list('enrolled=no'))).toEqual([meena.id]);
    expect(ids(await list('country=AE'))).toEqual([meena.id]);
    expect(ids(await list('q=meena'))).toEqual([meena.id]);
    expect(ids(await list('q=45678'))).toEqual([ravi.id]);
    expect(ids(await list('status=suspended'))).toEqual([]);
  });

  it('shows the full profile with enrollments and live sessions (device only)', async () => {
    const { jar } = await loginAs(ctx, 'support_manager');
    const { data } = await readJson(await getJson(ctx.app, `/admin/students/${ravi.id}`, jar));
    expect(data).toMatchObject({ firstName: 'Ravi', phone: '+919812345678', email: ravi.email, status: 'active' });
    expect(data.enrollments).toHaveLength(1);
    expect(data.enrollments[0]).toMatchObject({ source: 'manual', status: 'active' });
    expect(data.sessions).toHaveLength(1);
    expect(Object.keys(data.sessions[0]).sort()).toEqual(['device', 'id', 'lastActiveAt', 'signedInAt']);
  });

  it('edits allowed profile fields only, with an audit entry', async () => {
    const { jar } = await loginAs(ctx, 'support_manager');
    const res = await sendJson(ctx, 'PATCH', `/admin/students/${ravi.id}`, { certificateName: 'Ravi Kumar Patel', phone: '98765 43210' }, jar);
    expect(res.status).toBe(200);
    expect((await readJson(res)).data.changed.sort()).toEqual(['certificateName', 'phone']);
    const [row] = await ctx.db.select().from(users).where(eq(users.id, ravi.id));
    expect(row).toMatchObject({ certificateName: 'Ravi Kumar Patel', phone: '+919876543210' });
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'students.update'));
    expect(log.metadata).toMatchObject({ before: { phone: '+919812345678' }, after: { phone: '+919876543210' } });
    expect((await sendJson(ctx, 'PATCH', `/admin/students/${ravi.id}`, { email: 'x@y.z' }, jar)).status).toBe(400);
    expect((await sendJson(ctx, 'PATCH', `/admin/students/${ravi.id}`, { role: 'admin' }, jar)).status).toBe(400);
    // View-only roles can't edit.
    expect((await sendJson(ctx, 'PATCH', `/admin/students/${ravi.id}`, { firstName: 'X' }, (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);
  });

  it('suspends (signing the student out), unsuspends, revokes sessions and sends a reset link', async () => {
    const { jar } = await loginAs(ctx, 'support_manager');
    expect((await postJson(ctx.app, `/admin/students/${ravi.id}/suspend`, { reason: '' }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/students/${ravi.id}/suspend`, { reason: 'Shared login on a forum' }, jar)).status).toBe(200);
    expect(await ctx.db.$count(sessions, eq(sessions.userId, ravi.id))).toBe(0);
    expect((await getJson(ctx.app, '/me', ravi.jar)).status).toBe(401);
    expect((await postJson(ctx.app, `/admin/students/${ravi.id}/password-reset`, {}, jar)).status).toBe(422);
    expect((await postJson(ctx.app, `/admin/students/${ravi.id}/unsuspend`, {}, jar)).status).toBe(200);

    expect(await ctx.db.$count(sessions, eq(sessions.userId, meena.id))).toBe(1);
    const revoke = await readJson(await postJson(ctx.app, `/admin/students/${meena.id}/sessions/revoke`, {}, jar));
    expect(revoke.data.revoked).toBe(1);
    expect(await ctx.db.$count(sessions, eq(sessions.userId, meena.id))).toBe(0);

    expect((await postJson(ctx.app, `/admin/students/${meena.id}/password-reset`, {}, jar)).status).toBe(200);
    const jobs = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.template, 'password_reset'));
    expect(jobs.map((j) => j.toAddress)).toEqual([meena.email]);
    const actions = (await ctx.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
    expect(actions).toEqual(expect.arrayContaining(['students.suspend', 'students.unsuspend', 'students.sessions_revoke', 'students.password_reset']));
  });
});
