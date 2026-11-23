import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { certificates, courseModules, courses, lessonProgress, lessons } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { createTestContext, getJson, loginAs, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

/** A UTC instant at noon India time on `day`. */
const ist = (day: string) => new Date(`${day}T12:00:00+05:30`);

describe.skipIf(!dbAvailable)('admin learning progress (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

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
  });

  const lessonsOf = async (slug: string) =>
    ctx.db
      .select({ id: lessons.id, title: lessons.title })
      .from(lessons)
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(eq(courses.slug, slug))
      .orderBy(asc(courseModules.sortOrder), asc(lessons.sortOrder));
  const progress = (userId: string, lessonIds: string[], completedAt: Date | null, updatedAt = completedAt ?? ist('2026-11-03')) =>
    ctx.db.insert(lessonProgress).values(lessonIds.map((lessonId) => ({ userId, lessonId, completedAt, updatedAt, positionSeconds: 10 })));

  it('shows each started course with progress on the student page, most recent first', async () => {
    const admin = await loginAs(ctx, 'admin');
    const student = await loginAs(ctx, 'student', 'Ravi');
    const bitlocker = await lessonsOf('bitlocker');
    const logical = await lessonsOf('logical');
    await progress(student.id, bitlocker.slice(0, 2).map((l) => l.id), ist('2026-11-01'));
    await progress(student.id, [logical[0].id], null, ist('2026-11-05'));

    const { data } = await readJson(await getJson(ctx.app, `/admin/students/${student.id}`, admin.jar));
    expect(data.learning).toEqual([
      expect.objectContaining({ slug: 'logical', lessonsTotal: 26, lessonsCompleted: 0, progressPct: 0, lastActivityAt: ist('2026-11-05').toISOString() }),
      expect.objectContaining({ slug: 'bitlocker', lessonsTotal: bitlocker.length, lessonsCompleted: 2, progressPct: Math.round((2 / bitlocker.length) * 100) }),
    ]);
  });

  it('learning report: completions by India day, active learners, certificates, completion and where learners stop', async () => {
    const [a, b] = [await loginAs(ctx, 'student', 'A'), await loginAs(ctx, 'student', 'B')];
    const staff = await loginAs(ctx, 'content_manager');
    const bitlocker = await lessonsOf('bitlocker');
    const ids = bitlocker.map((l) => l.id);
    await progress(a.id, ids, ist('2026-11-02')); // A finished BitLocker
    await progress(b.id, ids.slice(0, 1), ist('2026-11-04'));
    await progress(b.id, ids.slice(1, 2), null, ist('2026-11-04')); // B stopped on lesson 2
    await progress(staff.id, ids.slice(0, 1), ist('2026-11-04')); // staff progress is ignored
    const [course] = await ctx.db.select().from(courses).where(eq(courses.slug, 'bitlocker'));
    await ctx.db.insert(certificates).values({ code: 'AR-2026-00001', userId: a.id, courseId: course.id, recipientName: 'A', programTitle: course.title, issuedAt: ist('2026-11-02') });

    const { data } = await readJson(await getJson(ctx.app, '/admin/reports/learning?from=2026-11-01&to=2026-11-07', staff.jar));
    expect(data.totals).toEqual({ lessonsCompleted: ids.length + 1, activeLearners: 2, certificatesIssued: 1 });
    expect(data.series.points.find((p: { bucket: string }) => p.bucket === '2026-11-02').count).toBe(ids.length);
    expect(data.series.points.find((p: { bucket: string }) => p.bucket === '2026-11-04').count).toBe(1);
    expect(data.breakdowns.courseCompletion).toEqual([{ key: course.title, count: 1, of: 2 }]);
    expect(data.breakdowns.topLessons[0]).toEqual({ key: `${bitlocker[0].title} · ${course.title}`, count: 2 });
    expect(data.breakdowns.stuckLessons).toEqual([{ key: `${bitlocker[1].title} · ${course.title}`, count: 1 }]);
  });

  it('is visible to every staff role that can view students or courses (all of them today), never to students', async () => {
    for (const role of ['admin', 'support_manager', 'content_manager', 'finance_manager'] as const) {
      expect((await getJson(ctx.app, '/admin/reports/learning', (await loginAs(ctx, role)).jar)).status).toBe(200);
    }
    expect((await getJson(ctx.app, '/admin/reports/learning', (await loginAs(ctx, 'student')).jar)).status).toBe(403);
  });
});
