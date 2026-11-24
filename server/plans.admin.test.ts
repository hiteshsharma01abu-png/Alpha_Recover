import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, courses, planCourses, plans, promotions } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { grantEnrollment } from './services/enrollments';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

/** "YYYY-MM-DDTHH:mm" in IST, `hours` from now. */
const ist = (hours: number) => new Date(Date.now() + hours * 3_600_000 + 5.5 * 3_600_000).toISOString().slice(0, 16);

const newPlan = (over: Record<string, unknown> = {}) => ({
  slug: 'weekend-batch',
  name: 'Weekend Batch',
  pricePaise: 999_900,
  features: ['Saturday classes', 'Lab access', 'Certificate'],
  grantsAllCourses: true,
  status: 'draft',
  ...over,
});

describe.skipIf(!dbAvailable)('admin plans & promotions API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let pro: typeof plans.$inferSelect;

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
    [pro] = await ctx.db.select().from(plans).where(eq(plans.slug, 'professional'));
    // The seeded sale may already be over; start each test without one.
    await ctx.db.delete(promotions);
  });

  it('lists plans with live pricing and enrollment counts; content managers can only view', async () => {
    const student = await loginAs(ctx, 'student');
    await grantEnrollment(ctx.db, { userId: student.id, planId: pro.id, source: 'manual' });
    const content = await loginAs(ctx, 'content_manager');
    const { data } = await readJson(await getJson(ctx.app, '/admin/plans', content.jar));
    expect(data).toHaveLength(3);
    const proRow = data.find((p: { slug: string }) => p.slug === 'professional');
    expect(proRow).toMatchObject({ slug: 'professional', status: 'published', effectivePricePaise: pro.pricePaise, activeEnrollments: 1, nextPromotion: null });
    expect((await postJson(ctx.app, '/admin/plans', newPlan(), content.jar)).status).toBe(403);
    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { name: 'X' }, content.jar)).status).toBe(403);
  });

  it('creates a plan limited to chosen courses, rejecting bad input and taken slugs', async () => {
    const { jar } = await loginAs(ctx, 'finance_manager');
    const [course] = await ctx.db.select({ id: courses.id }).from(courses).limit(1);
    const res = await postJson(ctx.app, '/admin/plans', newPlan({ grantsAllCourses: false, courseIds: [course.id], accessDays: 180, mobileFeatureOrder: [2, 0] }), jar);
    expect(res.status).toBe(201);
    const { id } = (await readJson(res)).data;
    const detail = (await readJson(await getJson(ctx.app, `/admin/plans/${id}`, jar))).data;
    expect(detail).toMatchObject({ slug: 'weekend-batch', courseIds: [course.id], accessDays: 180, mobileFeatureOrder: [2, 0], status: 'draft', enrollments: 0 });
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'plans.create'))).toBe(1);

    expect((await postJson(ctx.app, '/admin/plans', newPlan(), jar)).status).toBe(409);
    expect((await postJson(ctx.app, '/admin/plans', newPlan({ slug: 'Bad Slug' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/plans', newPlan({ slug: 'b', compareAtPaise: 500_000 }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/plans', newPlan({ slug: 'c', grantsAllCourses: false }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/plans', newPlan({ slug: 'd', mobileFeatureOrder: [5] }), jar)).status).toBe(400);
    // Draft plans stay off the public API.
    expect((await getJson(ctx.app, '/plans/weekend-batch')).status).toBe(404);
  });

  it('updates price and features (public API follows), keeps the slug, audits before/after', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const res = await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { pricePaise: 699_900, features: ['One', 'Two'], mobileFeatureOrder: null }, jar);
    expect(res.status).toBe(200);
    expect((await readJson(res)).data.changed.sort()).toEqual(['features', 'mobileFeatureOrder', 'pricePaise']);
    const pub = (await readJson(await getJson(ctx.app, '/plans/professional'))).data;
    expect(pub).toMatchObject({ pricePaise: 699_900, effectivePricePaise: 699_900, features: ['One', 'Two'], mobileFeatureOrder: null });
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'plans.update'));
    expect(log.metadata).toMatchObject({ before: { pricePaise: pro.pricePaise }, after: { pricePaise: 699_900 } });

    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { slug: 'renamed' }, jar)).status).toBe(400);
    const noop = await readJson(await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { pricePaise: 699_900 }, jar));
    expect(noop.data.changed).toEqual([]);
  });

  it('switches between all courses and a course list', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const all = await ctx.db.select({ id: courses.id }).from(courses);
    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { grantsAllCourses: false }, jar)).status).toBe(400);
    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { grantsAllCourses: false, courseIds: [all[0].id, all[1].id] }, jar)).status).toBe(200);
    expect(await ctx.db.$count(planCourses, eq(planCourses.planId, pro.id))).toBe(2);
    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { grantsAllCourses: true, courseIds: [] }, jar)).status).toBe(200);
    expect(await ctx.db.$count(planCourses, eq(planCourses.planId, pro.id))).toBe(0);
  });

  it('deletes only plans with no enrollments', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const student = await loginAs(ctx, 'student');
    await grantEnrollment(ctx.db, { userId: student.id, planId: pro.id, source: 'manual' });
    expect((await sendJson(ctx, 'DELETE', `/admin/plans/${pro.id}`, {}, jar)).status).toBe(422);
    const { id } = (await readJson(await postJson(ctx.app, '/admin/plans', newPlan(), jar))).data;
    expect((await sendJson(ctx, 'DELETE', `/admin/plans/${id}`, {}, jar)).status).toBe(200);
    expect((await getJson(ctx.app, `/admin/plans/${id}`, jar)).status).toBe(404);
    // Finance has plans.delete too; support has no plans access at all.
    expect((await getJson(ctx.app, '/admin/plans', (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
  });

  it('runs a sale: create, price shows on the site, overlap refused, pause and resume, delete', async () => {
    const { jar } = await loginAs(ctx, 'finance_manager');
    const sale = { label: 'Diwali Sale', salePricePaise: 399_900, startsAt: ist(-1), endsAt: ist(48) };
    const res = await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, sale, jar);
    expect(res.status).toBe(201);
    const { id } = (await readJson(res)).data;
    let pub = (await readJson(await getJson(ctx.app, '/plans/professional'))).data;
    expect(pub).toMatchObject({ effectivePricePaise: 399_900, comparePricePaise: pro.pricePaise, promotion: { label: 'Diwali Sale' } });

    // Overlapping, not cheaper, already over, or ending before it starts.
    expect((await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, { ...sale, label: 'Clash', startsAt: ist(24), endsAt: ist(72) }, jar)).status).toBe(422);
    expect((await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, { ...sale, startsAt: ist(100), endsAt: ist(120), salePricePaise: pro.pricePaise }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, { ...sale, startsAt: ist(-48), endsAt: ist(-24) }, jar)).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, { ...sale, startsAt: ist(120), endsAt: ist(100) }, jar)).status).toBe(400);
    // A later, non-overlapping sale is fine and shows as scheduled.
    const later = await readJson(await postJson(ctx.app, `/admin/plans/${pro.id}/promotions`, { ...sale, label: 'New Year', startsAt: ist(100), endsAt: ist(120) }, jar));
    const listed = (await readJson(await getJson(ctx.app, '/admin/plans', jar))).data.find(
      (p: { slug: string }) => p.slug === 'professional',
    );
    expect(listed.nextPromotion).toMatchObject({ id: later.data.id, state: 'scheduled' });

    // The plan price can't drop to or below a live sale price.
    expect((await sendJson(ctx, 'PATCH', `/admin/plans/${pro.id}`, { pricePaise: 399_900 }, jar)).status).toBe(422);

    const paused = await readJson(await sendJson(ctx, 'PATCH', `/admin/promotions/${id}`, { isActive: false }, jar));
    expect(paused.data.state).toBe('paused');
    pub = (await readJson(await getJson(ctx.app, '/plans/professional'))).data;
    expect(pub.promotion).toBeNull();
    expect((await sendJson(ctx, 'PATCH', `/admin/promotions/${id}`, { isActive: true, salePricePaise: 449_900 }, jar)).status).toBe(200);
    pub = (await readJson(await getJson(ctx.app, '/plans/professional'))).data;
    expect(pub.effectivePricePaise).toBe(449_900);

    expect((await sendJson(ctx, 'DELETE', `/admin/promotions/${id}`, {}, jar)).status).toBe(200);
    pub = (await readJson(await getJson(ctx.app, '/plans/professional'))).data;
    expect(pub.promotion).toBeNull();
    const actions = (await ctx.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
    expect(actions).toEqual(expect.arrayContaining(['plans.promotion_create', 'plans.promotion_pause', 'plans.promotion_resume', 'plans.promotion_delete']));
  });

  it('treats ended sales as history', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const [row] = await ctx.db
      .insert(promotions)
      .values({ planId: pro.id, label: 'Old', salePricePaise: 100_000, startsAt: new Date(Date.now() - 86_400_000 * 3), endsAt: new Date(Date.now() - 86_400_000) })
      .$returningId();
    const detail = (await readJson(await getJson(ctx.app, `/admin/plans/${pro.id}`, jar))).data;
    expect(detail.promotions[0]).toMatchObject({ id: row.id, state: 'ended' });
    expect((await sendJson(ctx, 'PATCH', `/admin/promotions/${row.id}`, { label: 'Edited' }, jar)).status).toBe(422);
  });
});
