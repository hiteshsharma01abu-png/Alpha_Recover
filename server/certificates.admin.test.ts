import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, certificates, plans, users } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');
const PROGRAM = 'Professional Data Recovery Training';
const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date()));

describe.skipIf(!dbAvailable)('admin certificates API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let ravi: Awaited<ReturnType<typeof loginAs>>;

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
    await ctx.db.update(users).set({ lastName: 'Patel', certificateName: 'Ravi Kumar Patel' }).where(eq(users.id, ravi.id));
  });

  const verify = async (code: string) => readJson(await ctx.app.request(`/api/v1/certificates/verify/${code}`));

  it('issues with the next code and the student’s certificate name; public verify finds it', async () => {
    const { jar, id: adminId } = await loginAs(ctx, 'admin');
    const [plan] = await ctx.db.select().from(plans);
    const res = await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM, planId: plan.id }, jar);
    expect(res.status).toBe(201);
    const { data } = await readJson(res);
    expect(data).toMatchObject({ code: `AR-${year}-00001`, recipientName: 'Ravi Kumar Patel' });
    const [row] = await ctx.db.select().from(certificates).where(eq(certificates.id, data.id));
    expect(row).toMatchObject({ issuedBy: adminId, planId: plan.id, status: 'valid' });
    expect((await verify(data.code)).data).toMatchObject({ status: 'valid', recipientName: 'Ravi Kumar Patel', programTitle: PROGRAM });
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'certificates.issue'));
    expect(log.metadata).toMatchObject({ code: data.code, userId: ravi.id });

    // Same program again → refused; a different program gets the next number.
    expect((await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM }, jar)).status).toBe(409);
    const next = await readJson(await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: 'Firmware Repair Workshop', recipientName: 'R. K. Patel' }, jar));
    expect(next.data).toMatchObject({ code: `AR-${year}-00002`, recipientName: 'R. K. Patel' });
  });

  it('records an earlier offline batch under that year, never a future date; staff can’t receive one', async () => {
    const { jar, id: adminId } = await loginAs(ctx, 'admin');
    const back = await readJson(await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM, issuedOn: '2025-03-15' }, jar));
    expect(back.data.code).toBe('AR-2025-00001');
    expect((await verify(back.data.code)).data.issuedAt).toBe('2025-03-15');
    expect((await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: 'Other', issuedOn: `${year + 1}-01-01` }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/certificates', { userId: adminId, programTitle: PROGRAM }, jar)).status).toBe(404);
  });

  it('corrects the printed name (same code), then revokes with a reason the public never sees', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const { data } = await readJson(await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM }, jar));
    expect((await sendJson(ctx, 'PATCH', `/admin/certificates/${data.id}`, { recipientName: 'Ravi Kumaar Patel' }, jar)).status).toBe(200);
    expect((await verify(data.code)).data.recipientName).toBe('Ravi Kumaar Patel');
    const [upd] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'certificates.update'));
    expect(upd.metadata).toMatchObject({ before: { recipientName: 'Ravi Kumar Patel' }, after: { recipientName: 'Ravi Kumaar Patel' } });

    expect((await postJson(ctx.app, `/admin/certificates/${data.id}/revoke`, { reason: '' }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/certificates/${data.id}/revoke`, { reason: 'Issued to the wrong student' }, jar)).status).toBe(200);
    const pub = await verify(data.code);
    expect(pub.data.status).toBe('revoked');
    expect(JSON.stringify(pub)).not.toContain('wrong student');
    expect((await postJson(ctx.app, `/admin/certificates/${data.id}/revoke`, { reason: 'Again please' }, jar)).status).toBe(422);
    expect((await sendJson(ctx, 'PATCH', `/admin/certificates/${data.id}`, { recipientName: 'X Y' }, jar)).status).toBe(422);
    // Revoked → a new certificate for the same program is allowed.
    expect((await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM }, jar)).status).toBe(201);
  });

  it('lists with counts, search by code/name/email and masked emails; support can only look', async () => {
    const admin = await loginAs(ctx, 'admin');
    const a = (await readJson(await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM }, admin.jar))).data;
    const b = (await readJson(await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: 'Firmware Repair Workshop' }, admin.jar))).data;
    await postJson(ctx.app, `/admin/certificates/${b.id}/revoke`, { reason: 'Duplicate' }, admin.jar);

    const support = await loginAs(ctx, 'support_manager');
    const list = async (qs = '') => readJson(await getJson(ctx.app, `/admin/certificates?${qs}`, support.jar));
    const all = await list();
    expect(all.meta).toMatchObject({ total: 2, counts: { valid: 1, revoked: 1 } });
    expect(all.data[0].student.email).toMatch(/\*\*\*@example\.com$/);
    expect((await list('status=revoked')).data.map((r: { id: string }) => r.id)).toEqual([b.id]);
    expect((await list(`q=${a.code}`)).data.map((r: { id: string }) => r.id)).toEqual([a.id]);
    expect((await list('q=kumar')).meta.total).toBe(2);
    expect((await list(`userId=${ravi.id}`)).meta.total).toBe(2);
    expect((await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: 'X program' }, support.jar)).status).toBe(403);
    expect((await getJson(ctx.app, '/admin/certificates', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);

    const programs = (await readJson(await getJson(ctx.app, '/admin/certificates/programs', support.jar))).data;
    expect(programs.plans.length).toBeGreaterThan(0);
    expect(programs.courses.length).toBeGreaterThan(0);
  });

  it('exports CSV with full emails and logs it', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    await postJson(ctx.app, '/admin/certificates', { userId: ravi.id, programTitle: PROGRAM }, jar);
    const res = await getJson(ctx.app, '/admin/certificates/export.csv', jar);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(ravi.email);
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'certificates.export'))).toBe(1);
  });
});
