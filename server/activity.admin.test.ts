import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { can, USER_ROLES, type Permission } from '../shared/permissions';
import { activityLogs } from './db/schema';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');
const SOME_ID = '01a1d000-0000-7000-8000-0000000000ff';

describe.skipIf(!dbAvailable)('admin activity log API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
  });

  it('lists entries newest first with the actor, filters them, and never returns the IP hash', async () => {
    const owner = await loginAs(ctx, 'super_admin', 'Hitesh');
    const support = await loginAs(ctx, 'support_manager', 'Neha');
    await ctx.db.delete(activityLogs); // drop the sign-up entries
    await ctx.db.insert(activityLogs).values([
      { actorId: support.id, actorRole: 'support_manager', action: 'leads.update', entityType: 'lead', entityId: 'L1', metadata: { after: { status: 'contacted' } }, ipHash: 'x'.repeat(64), createdAt: new Date('2026-11-10T06:00:00Z') },
      { actorId: support.id, actorRole: 'support_manager', action: 'leads.note', entityType: 'lead', entityId: 'L1', createdAt: new Date('2026-11-11T06:00:00Z') },
      { actorId: owner.id, actorRole: 'super_admin', action: 'team.invite', entityType: 'user', entityId: support.id, createdAt: new Date('2026-11-12T06:00:00Z') },
      { actorId: null, action: 'auth.login_failed', createdAt: new Date('2026-11-12T07:00:00Z') },
    ]);
    const list = async (qs = '') => readJson(await getJson(ctx.app, `/admin/activity?${qs}`, owner.jar));

    const all = await list();
    expect(all.data.map((e: { action: string }) => e.action)).toEqual(['auth.login_failed', 'team.invite', 'leads.note', 'leads.update']);
    expect(all.data[3]).toMatchObject({ actor: { id: support.id, firstName: 'Neha' }, actorRole: 'support_manager', entityType: 'lead', metadata: { after: { status: 'contacted' } } });
    expect(all.data[0].actor).toBeNull();
    expect(all.data[3].ipHash).toBeUndefined();

    expect((await list('action=leads.')).data).toHaveLength(2);
    expect((await list('action=leads.note')).data).toHaveLength(1);
    expect((await list(`actor=${owner.id}`)).data.map((e: { action: string }) => e.action)).toEqual(['team.invite']);
    expect((await list('entityType=lead&entityId=L1')).meta.total).toBe(2);
    expect((await list('from=2026-11-11&to=2026-11-11')).data.map((e: { action: string }) => e.action)).toEqual(['leads.note']);
    expect((await getJson(ctx.app, '/admin/activity?action=DROP%20TABLE', owner.jar)).status).toBe(400);

    const facets = (await readJson(await getJson(ctx.app, '/admin/activity/facets', owner.jar))).data;
    expect(facets.actions).toEqual(['auth.login_failed', 'leads.note', 'leads.update', 'team.invite']);
    expect(facets.actors.map((a: { firstName: string }) => a.firstName)).toEqual(['Hitesh', 'Neha']);
  });

  it('exports CSV (audited) for roles with audit.export only', async () => {
    const admin = await loginAs(ctx, 'admin');
    await ctx.db.insert(activityLogs).values({ action: 'students.update', metadata: { after: { firstName: '=cmd' } } });
    const res = await getJson(ctx.app, '/admin/activity/export.csv', admin.jar);
    expect(res.status).toBe(200);
    const csv = new TextDecoder().decode(await res.arrayBuffer());
    expect(csv.split('\r\n')[0]).toBe('Time (UTC),Action,Actor,Actor email,Actor role,Entity type,Entity id,Details,Request id');
    expect(csv).toContain('students.update');
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'audit.export'))).toBe(1);
    for (const role of ['support_manager', 'finance_manager', 'content_manager'] as const) {
      expect((await getJson(ctx.app, '/admin/activity', (await loginAs(ctx, role)).jar)).status).toBe(403);
    }
  });
});

/**
 * Every admin route × every role, compared with shared/permissions.ts (docs/admin/AUTH_AND_RBAC.md §4).
 * Add new admin routes here: a route missing its permission check fails this test.
 */
const ROUTES: [method: string, path: string, permission: Permission | null][] = [
  ['GET', '/admin/me', null],
  ['GET', '/admin/dashboard', null],
  ['GET', '/admin/leads', 'leads.view'],
  ['GET', '/admin/leads/assignees', 'leads.view'],
  ['GET', '/admin/leads/export.csv', 'leads.export'],
  ['GET', `/admin/leads/${SOME_ID}`, 'leads.view'],
  ['PATCH', `/admin/leads/${SOME_ID}`, 'leads.edit'],
  ['POST', `/admin/leads/${SOME_ID}/notes`, 'leads.edit'],
  ['GET', '/admin/students', 'students.view'],
  ['GET', `/admin/students/${SOME_ID}`, 'students.view'],
  ['PATCH', `/admin/students/${SOME_ID}`, 'students.edit'],
  ['POST', `/admin/students/${SOME_ID}/suspend`, 'students.edit'],
  ['POST', `/admin/students/${SOME_ID}/unsuspend`, 'students.edit'],
  ['POST', `/admin/students/${SOME_ID}/sessions/revoke`, 'students.edit'],
  ['POST', `/admin/students/${SOME_ID}/password-reset`, 'students.edit'],
  ['GET', '/admin/team', 'team.view'],
  ['POST', '/admin/team', 'team.add'],
  ['POST', `/admin/team/${SOME_ID}/resend-invite`, 'team.add'],
  ['PATCH', `/admin/team/${SOME_ID}/role`, 'team.manage_roles'],
  ['POST', `/admin/team/${SOME_ID}/deactivate`, 'team.edit'],
  ['POST', `/admin/team/${SOME_ID}/reactivate`, 'team.edit'],
  ['GET', '/admin/activity', 'audit.view'],
  ['GET', '/admin/activity/facets', 'audit.view'],
  ['GET', '/admin/activity/export.csv', 'audit.export'],
];

describe.skipIf(!dbAvailable)('admin route × role permission matrix (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  beforeAll(async () => {
    ctx = createTestContext();
    await resetTables(ctx.db);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it.each(USER_ROLES)('%s gets exactly the routes its permissions allow', async (role) => {
    const { jar } = await loginAs(ctx, role);
    const wrong: string[] = [];
    for (const [method, path, perm] of ROUTES) {
      const res = method === 'GET' ? await getJson(ctx.app, path, jar) : method === 'POST' ? await postJson(ctx.app, path, {}, jar) : await sendJson(ctx, method, path, {}, jar);
      const allowed = role !== 'student' && (perm === null || can(role, perm));
      if ((res.status === 403) === allowed) wrong.push(`${method} ${path} → ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });
});
