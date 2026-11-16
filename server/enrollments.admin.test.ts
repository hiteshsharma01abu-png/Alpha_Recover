import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, enrollments, plans } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { grantEnrollment } from './services/enrollments';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

/** YYYY-MM-DD `days` from now (IST is close enough for a date well away from midnight). */
const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!dbAvailable)('admin enrollments API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let ravi: Awaited<ReturnType<typeof loginAs>>;
  let meena: Awaited<ReturnType<typeof loginAs>>;
  let planId: string;

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
    [{ id: planId }] = await ctx.db.select({ id: plans.id }).from(plans);
  });

  it('grants access with the plan default, a date or lifetime, and refuses a second active grant', async () => {
    const { jar, id: adminId } = await loginAs(ctx, 'admin');
    const res = await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'complimentary', reason: 'Workshop winner' }, jar);
    expect(res.status).toBe(201);
    const [row] = await ctx.db.select().from(enrollments).where(eq(enrollments.userId, ravi.id));
    expect(row).toMatchObject({ source: 'complimentary', status: 'active', grantedBy: adminId });
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'enrollments.grant'));
    expect(log).toMatchObject({ entityId: row.id, actorId: adminId });
    expect(log.metadata).toMatchObject({ reason: 'Workshop winner', source: 'complimentary' });

    const again = await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'manual', reason: 'Duplicate' }, jar);
    expect(again.status).toBe(409);

    const dated = await readJson(await postJson(ctx.app, '/admin/enrollments', { userId: meena.id, planId, source: 'manual', expiresOn: day(30), reason: 'Paid cash at the office' }, jar));
    expect(Date.parse(dated.data.expiresAt)).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    // Past dates, staff accounts and missing reasons are rejected.
    const support = await loginAs(ctx, 'support_manager');
    expect((await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'manual', expiresOn: day(-2), reason: 'Backdated' }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/enrollments', { userId: support.id, planId, source: 'manual', reason: 'Staff' }, jar)).status).toBe(404);
    expect((await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'manual', reason: '' }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'purchase', reason: 'Fake purchase' }, jar)).status).toBe(400);
  });

  it('replaces an active-but-ended enrollment the cron has not expired yet', async () => {
    const { jar } = await loginAs(ctx, 'finance_manager');
    await grantEnrollment(ctx.db, { userId: ravi.id, planId, source: 'manual', expiresAt: new Date(Date.now() - 60_000) });
    const res = await postJson(ctx.app, '/admin/enrollments', { userId: ravi.id, planId, source: 'manual', expiresOn: null, reason: 'Renewed' }, jar);
    expect(res.status).toBe(201);
    const rows = await ctx.db.select().from(enrollments).where(eq(enrollments.userId, ravi.id));
    expect(rows.map((r) => r.status).sort()).toEqual(['active', 'expired']);
  });

  it('lists with computed status, counts, filters and masked emails', async () => {
    const { enrollment: live } = await grantEnrollment(ctx.db, { userId: ravi.id, planId, source: 'manual' });
    await grantEnrollment(ctx.db, { userId: meena.id, planId, source: 'complimentary', expiresAt: new Date(Date.now() - 60_000) });
    const { jar } = await loginAs(ctx, 'support_manager');
    const list = async (qs = '') => readJson(await getJson(ctx.app, `/admin/enrollments?${qs}`, jar));

    const all = await list();
    expect(all.meta).toMatchObject({ total: 2, counts: { active: 1, expired: 1, revoked: 0 } });
    const r = all.data.find((e: { id: string }) => e.id === live.id);
    expect(r).toMatchObject({ status: 'active', source: 'manual', student: { id: ravi.id, firstName: 'Ravi' }, expiresAt: null });
    expect(r.student.email).toMatch(/^st\*\*\*@example\.com$/);

    expect((await list('status=expired')).data.map((e: { student: { id: string } }) => e.student.id)).toEqual([meena.id]);
    expect((await list('status=active')).data.map((e: { id: string }) => e.id)).toEqual([live.id]);
    expect((await list('source=complimentary')).meta.total).toBe(1);
    expect((await list('q=meena')).meta).toMatchObject({ total: 1, counts: { active: 0, expired: 1 } });
    expect((await list(`userId=${ravi.id}`)).meta.total).toBe(1);

    const plansRes = await readJson(await getJson(ctx.app, '/admin/enrollments/plans', jar));
    expect(plansRes.data.map((p: { id: string }) => p.id)).toContain(planId);
  });

  it('changes the end date of active enrollments only', async () => {
    const { enrollment } = await grantEnrollment(ctx.db, { userId: ravi.id, planId, source: 'manual' });
    const { jar } = await loginAs(ctx, 'admin');
    const res = await sendJson(ctx, 'PATCH', `/admin/enrollments/${enrollment.id}`, { expiresOn: day(60) }, jar);
    expect(res.status).toBe(200);
    const [row] = await ctx.db.select().from(enrollments).where(eq(enrollments.id, enrollment.id));
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86_400_000);
    expect((await sendJson(ctx, 'PATCH', `/admin/enrollments/${enrollment.id}`, { expiresOn: null }, jar)).status).toBe(200);
    expect((await sendJson(ctx, 'PATCH', `/admin/enrollments/${enrollment.id}`, { expiresOn: day(-1) }, jar)).status).toBe(400);
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'enrollments.update'));
    expect(log.metadata).toMatchObject({ before: { expiresAt: null } });

    await postJson(ctx.app, `/admin/enrollments/${enrollment.id}/revoke`, { reason: 'Chargeback' }, jar);
    expect((await sendJson(ctx, 'PATCH', `/admin/enrollments/${enrollment.id}`, { expiresOn: day(10) }, jar)).status).toBe(422);
  });

  it('revokes with a reason, ending course access, once', async () => {
    const { enrollment } = await grantEnrollment(ctx.db, { userId: ravi.id, planId, source: 'manual' });
    const { jar } = await loginAs(ctx, 'finance_manager');
    expect((await getJson(ctx.app, '/me/enrollments', ravi.jar)).status).toBe(200);
    expect((await postJson(ctx.app, `/admin/enrollments/${enrollment.id}/revoke`, { reason: '' }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/enrollments/${enrollment.id}/revoke`, { reason: 'Refunded in cash' }, jar)).status).toBe(200);
    const [row] = await ctx.db.select().from(enrollments).where(eq(enrollments.id, enrollment.id));
    expect(row).toMatchObject({ status: 'revoked', revokedReason: 'Refunded in cash' });
    expect((await postJson(ctx.app, `/admin/enrollments/${enrollment.id}/revoke`, { reason: 'Again please' }, jar)).status).toBe(422);
    const mine = await readJson(await getJson(ctx.app, '/me/enrollments', ravi.jar));
    expect(mine.data[0].status).toBe('revoked');
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'enrollments.revoke'))).toBe(1);
  });

  it('exports CSV with full emails and logs the export', async () => {
    await grantEnrollment(ctx.db, { userId: ravi.id, planId, source: 'manual' });
    const { jar } = await loginAs(ctx, 'finance_manager');
    const res = await getJson(ctx.app, '/admin/enrollments/export.csv?status=active', jar);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain(ravi.email);
    expect(csv).toContain('lifetime');
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'enrollments.export'))).toBe(1);
  });
});
