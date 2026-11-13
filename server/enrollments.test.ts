import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { courses, enrollments, planCourses, plans, users } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { accessibleCourseIds, canAccessCourse, expireEnrollments, grantEnrollment, revokeEnrollment } from './services/enrollments';
import { CookieJar, createTestContext, getJson, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('enrollments (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let userId: string;
  let planId: string;
  let jar: CookieJar;
  const courseId = async (slug: string) => (await ctx.db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)))[0].id;

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
    jar = new CookieJar();
    await postJson(
      ctx.app,
      '/auth/register',
      { firstName: 'Ravi', email: 'ravi@example.com', country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
      jar,
    );
    userId = (await ctx.db.select().from(users))[0].id;
    planId = (await ctx.db.select().from(plans))[0].id;
  });

  describe('granting', () => {
    it('grants once; repeating returns the same active enrollment', async () => {
      const first = await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect(first.created).toBe(true);
      expect(first.enrollment).toMatchObject({ status: 'active', source: 'manual', expiresAt: null });
      const again = await grantEnrollment(ctx.db, { userId, planId, source: 'complimentary' });
      expect(again).toMatchObject({ created: false });
      expect(again.enrollment.id).toBe(first.enrollment.id);
    });

    it('lets the database hold only one active enrollment per user and plan', async () => {
      await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      await expect(
        ctx.db.insert(enrollments).values({ userId, planId, source: 'manual', startsAt: new Date() }),
      ).rejects.toThrow();
    });

    it('activates an order at most once', async () => {
      const orderId = '01a1d000-0000-7000-8000-00000000000a';
      const a = await grantEnrollment(ctx.db, { userId, planId, source: 'purchase', orderId });
      const b = await grantEnrollment(ctx.db, { userId, planId, source: 'purchase', orderId });
      expect([a.created, b.created]).toEqual([true, false]);
      expect(await ctx.db.$count(enrollments)).toBe(1);
    });

    it('stays single under concurrent grants', async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => grantEnrollment(ctx.db, { userId, planId, source: 'manual' })));
      expect(await ctx.db.$count(enrollments)).toBe(1);
      expect(new Set(results.map((r) => r.enrollment.id)).size).toBe(1);
    });

    it('can be revoked, and re-granted afterwards as a new enrollment', async () => {
      const { enrollment } = await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect(await revokeEnrollment(ctx.db, enrollment.id, 'Refunded')).toBe(true);
      expect(await revokeEnrollment(ctx.db, enrollment.id, 'Again')).toBe(false);
      const [row] = await ctx.db.select().from(enrollments).where(eq(enrollments.id, enrollment.id));
      expect(row).toMatchObject({ status: 'revoked', revokedReason: 'Refunded' });
      const regrant = await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect(regrant.created).toBe(true);
      expect(await ctx.db.$count(enrollments)).toBe(2);
    });
  });

  describe('access rule', () => {
    it('a plan that grants all courses opens every course', async () => {
      expect((await accessibleCourseIds(ctx.db, userId)).size).toBe(0);
      await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect((await accessibleCourseIds(ctx.db, userId)).size).toBe(9);
      expect(await canAccessCourse(ctx.db, userId, await courseId('mrt'))).toBe(true);
    });

    it('a plan with listed courses opens only those', async () => {
      await ctx.db.update(plans).set({ grantsAllCourses: false });
      await ctx.db.insert(planCourses).values({ planId, courseId: await courseId('logical') });
      await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect(await canAccessCourse(ctx.db, userId, await courseId('logical'))).toBe(true);
      expect(await canAccessCourse(ctx.db, userId, await courseId('mrt'))).toBe(false);
    });

    it('expired or revoked enrollments open nothing', async () => {
      const { enrollment } = await grantEnrollment(ctx.db, { userId, planId, source: 'manual', expiresAt: new Date(Date.now() + 60_000) });
      const logical = await courseId('logical');
      expect(await canAccessCourse(ctx.db, userId, logical)).toBe(true);
      expect(await canAccessCourse(ctx.db, userId, logical, new Date(Date.now() + 120_000))).toBe(false);
      await revokeEnrollment(ctx.db, enrollment.id, 'test');
      expect(await canAccessCourse(ctx.db, userId, logical)).toBe(false);
    });

    it('the maintenance job marks ended enrollments as expired', async () => {
      await grantEnrollment(ctx.db, { userId, planId, source: 'manual', expiresAt: new Date(Date.now() - 1000) });
      expect(await expireEnrollments(ctx.db)).toBe(1);
      expect((await ctx.db.select().from(enrollments))[0].status).toBe('expired');
    });
  });

  describe('endpoints', () => {
    it('GET /me/enrollments lists the user’s enrollments', async () => {
      expect((await readJson(await getJson(ctx.app, '/me/enrollments', jar))).data).toEqual([]);
      await grantEnrollment(ctx.db, { userId, planId, source: 'complimentary' });
      const { data } = await readJson(await getJson(ctx.app, '/me/enrollments', jar));
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ status: 'active', source: 'complimentary', planSlug: 'professional', planName: 'Professional Plan', expiresAt: null });
    });

    it('GET /me/access/courses/:slug answers enrolled true/false', async () => {
      const check = async (slug: string) => readJson(await getJson(ctx.app, `/me/access/courses/${slug}`, jar));
      expect((await check('logical')).data).toEqual({ enrolled: false });
      await grantEnrollment(ctx.db, { userId, planId, source: 'manual' });
      expect((await check('logical')).data).toEqual({ enrolled: true });
      expect((await getJson(ctx.app, '/me/access/courses/nope', jar)).status).toBe(404);
      expect((await getJson(ctx.app, '/me/access/courses/logical', new CookieJar())).status).toBe(401);
    });
  });
});
