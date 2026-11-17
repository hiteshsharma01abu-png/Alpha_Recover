import { desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, demoVideos, leads, plans, users } from './db/schema';
import { seedCatalog, seedDemoVideos, seedPlans } from './db/seed';
import { grantEnrollment, revokeEnrollment } from './services/enrollments';
import { createTestContext, getJson, loginAs, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

/** A UTC instant at `hh:mm` India time on `day`. */
const ist = (day: string, hhmm = '12:00') => new Date(`${day}T${hhmm}:00+05:30`);

describe.skipIf(!dbAvailable)('admin reports API (MySQL)', () => {
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

  const report = async (jar: Parameters<typeof getJson>[2], path: string) => readJson(await getJson(ctx.app, `/admin/reports/${path}`, jar));

  it('leads: buckets by India day (not UTC), excludes spam from the series, breaks down by source/reason/status', async () => {
    await ctx.db.insert(leads).values([
      // 00:30 IST on Nov 2 is still Nov 1 in UTC: must count on Nov 2.
      { source: 'contact_form', reason: 'training', status: 'new', createdAt: ist('2026-11-02', '00:30') },
      { source: 'callback', reason: 'training', status: 'converted', createdAt: ist('2026-11-02') },
      { source: 'callback', reason: 'other', status: 'contacted', createdAt: ist('2026-11-05') },
      { source: 'contact_form', reason: 'other', status: 'spam', createdAt: ist('2026-11-05') },
      { source: 'contact_form', reason: 'training', status: 'new', createdAt: ist('2026-10-20') }, // outside the range
    ]);
    const { jar } = await loginAs(ctx, 'support_manager');
    const { data } = await report(jar, 'leads?from=2026-11-01&to=2026-11-07');
    expect(data.range).toEqual({ from: '2026-11-01', to: '2026-11-07', interval: 'day' });
    expect(data.series.points).toHaveLength(7);
    expect(data.series.points.find((p: { bucket: string }) => p.bucket === '2026-11-01').count).toBe(0);
    expect(data.series.points.find((p: { bucket: string }) => p.bucket === '2026-11-02').count).toBe(2);
    expect(data.totals).toEqual({ leads: 3, converted: 1, conversionPct: 33.3, spam: 1 });
    expect(data.breakdowns.source).toEqual([
      { key: 'callback', count: 2 },
      { key: 'contact_form', count: 1 },
    ]);
    expect(data.breakdowns.reason[0]).toEqual({ key: 'training', count: 2 });

    const weekly = await report(jar, 'leads?from=2026-11-01&to=2026-11-14&interval=week');
    // Nov 1 2026 is a Sunday: the weeks start Mon Oct 26, Nov 2 and Nov 9.
    expect(weekly.data.series.points.map((p: { bucket: string }) => p.bucket)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(weekly.data.series.points[1].count).toBe(3);
  });

  it('students and enrollments: sign-ups, verification, sources, revokes and active now', async () => {
    await seedCatalog(ctx.db);
    await seedPlans(ctx.db);
    const a = await loginAs(ctx, 'student', 'A');
    const b = await loginAs(ctx, 'student', 'B');
    await ctx.db.update(users).set({ emailVerified: true, country: 'AE' }).where(eq(users.id, a.id));
    const [plan] = await ctx.db.select().from(plans);
    await grantEnrollment(ctx.db, { userId: a.id, planId: plan.id, source: 'manual' });
    const { enrollment } = await grantEnrollment(ctx.db, { userId: b.id, planId: plan.id, source: 'complimentary' });
    await revokeEnrollment(ctx.db, enrollment.id, 'test');

    const { jar } = await loginAs(ctx, 'admin');
    const students = (await report(jar, 'students')).data;
    expect(students.totals).toMatchObject({ signups: 2, verified: 1, verifiedPct: 50 });
    expect(students.breakdowns.country.map((c: { key: string }) => c.key).sort()).toEqual(['AE', 'IN']);
    expect(students.series.points).toHaveLength(30);

    const enr = (await report(jar, 'enrollments?interval=month')).data;
    expect(enr.totals).toEqual({ granted: 2, revoked: 1, activeNow: 1 });
    expect(enr.breakdowns.source.map((s: { key: string }) => s.key).sort()).toEqual(['complimentary', 'manual']);
  });

  it('content: demo views and lesson video coverage, without dates', async () => {
    await seedCatalog(ctx.db);
    await seedDemoVideos(ctx.db);
    const { jar } = await loginAs(ctx, 'content_manager');
    const { data } = await report(jar, 'content');
    const [top] = await ctx.db.select().from(demoVideos).orderBy(desc(demoVideos.viewCount));
    expect(data.totals.demoViews).toBeGreaterThan(0);
    expect(data.breakdowns.demoViews.length).toBe(6);
    expect(data.breakdowns.demoViews[0]).toEqual({ key: top.title, count: top.viewCount });
    expect(data.totals).toMatchObject({ publishedLessons: 117, lessonsWithVideo: 0 });
    expect(data.breakdowns.lessonsWithVideo[0]).toMatchObject({ count: 0 });
    expect(data.range).toBeUndefined();
  });

  it('only shows a role the reports for modules it can open; validates the range', async () => {
    const content = await loginAs(ctx, 'content_manager');
    expect((await getJson(ctx.app, '/admin/reports/leads', content.jar)).status).toBe(403);
    const finance = await loginAs(ctx, 'finance_manager');
    expect((await getJson(ctx.app, '/admin/reports/enrollments', finance.jar)).status).toBe(200);
    expect((await getJson(ctx.app, '/admin/reports/content', finance.jar)).status).toBe(403);
    const admin = await loginAs(ctx, 'admin');
    expect((await getJson(ctx.app, '/admin/reports/leads?from=2026-11-10&to=2026-11-01', admin.jar)).status).toBe(400);
    expect((await getJson(ctx.app, '/admin/reports/leads?from=2020-01-01&to=2026-11-01', admin.jar)).status).toBe(400);
    expect((await getJson(ctx.app, '/admin/reports/revenue', admin.jar)).status).toBe(400);
  });

  it('exports CSV (series + breakdowns) and logs it; content managers can view but not export', async () => {
    await ctx.db.insert(leads).values({ source: 'callback', reason: 'training', status: 'new', createdAt: ist('2026-11-03') });
    const { jar } = await loginAs(ctx, 'support_manager');
    const res = await getJson(ctx.app, '/admin/reports/leads/export.csv?from=2026-11-01&to=2026-11-03', jar);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('2026-11-03,1');
    expect(csv).toContain('source,callback,1');
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'reports.export'))).toBe(1);
    expect((await getJson(ctx.app, '/admin/reports/content/export.csv', (await loginAs(ctx, 'content_manager')).jar)).status).toBe(403);
  });
});
