import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { PUBLISH_STATUSES, courses, enrollments, planCourses, plans, promotions } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { validate } from '../../lib/validate';
import { liveEnrollment } from '../../services/enrollments';
import { priceFor } from '../../services/pricing';
import type { AppEnv } from '../../types';

const idParam = z.object({ id: z.uuid() });
const paise = z.number().int().min(100, 'At least ₹1').max(100_000_000, 'Too large');

const planFields = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  description: z.string().trim().max(2000).nullable(),
  pricePaise: paise,
  compareAtPaise: paise.nullable(),
  features: z.array(z.string().trim().min(1, 'Empty feature').max(200)).min(1, 'Add at least one feature').max(30),
  /** Indices into `features` shown on phones, in display order. null = all of them. */
  mobileFeatureOrder: z.array(z.number().int().min(0)).max(30).nullable(),
  grantsAllCourses: z.boolean(),
  /** Used when grantsAllCourses is false. */
  courseIds: z.array(z.uuid()).max(50),
  accessDays: z.number().int().min(1).max(3650).nullable(),
  status: z.enum(PUBLISH_STATUSES),
  sortOrder: z.number().int().min(0).max(1000),
});

/** Cross-field rules shared by create and update (applied to the merged result). */
function checkPlan(p: { pricePaise: number; compareAtPaise: number | null; features: string[]; mobileFeatureOrder: number[] | null; grantsAllCourses: boolean; courseIds: string[] }) {
  const details: { path: string; message: string }[] = [];
  if (p.compareAtPaise !== null && p.compareAtPaise <= p.pricePaise) details.push({ path: 'compareAtPaise', message: 'The "was" price must be higher than the price' });
  if (p.mobileFeatureOrder && (p.mobileFeatureOrder.some((i) => i >= p.features.length) || new Set(p.mobileFeatureOrder).size !== p.mobileFeatureOrder.length)) {
    details.push({ path: 'mobileFeatureOrder', message: 'Mobile features must point at listed features, once each' });
  }
  if (!p.grantsAllCourses && !p.courseIds.length) details.push({ path: 'courseIds', message: 'Pick at least one course, or grant all courses' });
  if (details.length) throw new AppError('VALIDATION_ERROR', details[0].message, { details });
}

/** "2026-11-30T23:59" in India time. The admin UI always works in IST (docs/admin/UI_UX.md). */
const istDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:mm (IST)')
  .transform((s, ctx) => {
    const d = new Date(`${s}:00+05:30`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Not a valid date' });
      return z.NEVER;
    }
    return d;
  });

const promotionFields = z.object({
  label: z.string().trim().min(2, 'Enter a label').max(120),
  salePricePaise: paise,
  startsAt: istDateTime,
  endsAt: istDateTime,
});

type PromotionRow = typeof promotions.$inferSelect;
export type PromotionState = 'running' | 'scheduled' | 'ended' | 'paused';

const promotionState = (p: PromotionRow, now: Date): PromotionState =>
  p.endsAt <= now ? 'ended' : !p.isActive ? 'paused' : p.startsAt > now ? 'scheduled' : 'running';

const promotionDto = (p: PromotionRow, now: Date) => ({
  id: p.id,
  label: p.label,
  salePricePaise: p.salePricePaise,
  startsAt: p.startsAt.toISOString(),
  endsAt: p.endsAt.toISOString(),
  isActive: p.isActive,
  state: promotionState(p, now),
});

async function loadPlan(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), isNull(plans.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Plan not found');
  return row;
}

async function loadPromotion(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.id, id), isNull(promotions.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Promotion not found');
  return row;
}

async function assertCourses(db: Database, ids: string[]) {
  if (!ids.length) return;
  const found = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(inArray(courses.id, ids), isNull(courses.deletedAt)));
  if (found.length !== new Set(ids).size) throw new AppError('VALIDATION_ERROR', 'Unknown course', { details: [{ path: 'courseIds', message: 'One of the courses no longer exists' }] });
}

/**
 * Promotion rules: ends after it starts, still to come or running, cheaper than the plan, and
 * no other live (active, not deleted) promotion of the same plan in an overlapping window.
 */
async function checkPromotion(db: Database, plan: typeof plans.$inferSelect, p: { salePricePaise: number; startsAt: Date; endsAt: Date; isActive: boolean }, excludeId?: string) {
  if (p.endsAt <= p.startsAt) throw new AppError('VALIDATION_ERROR', 'The sale must end after it starts', { details: [{ path: 'endsAt', message: 'Must be after the start' }] });
  if (p.endsAt <= new Date()) throw new AppError('VALIDATION_ERROR', 'The end time has already passed', { details: [{ path: 'endsAt', message: 'Must be in the future' }] });
  if (p.salePricePaise >= plan.pricePaise) throw new AppError('VALIDATION_ERROR', 'The sale price must be lower than the plan price', { details: [{ path: 'salePricePaise', message: 'Must be lower than the plan price' }] });
  if (!p.isActive) return;
  const where: SQL[] = [
    eq(promotions.planId, plan.id),
    eq(promotions.isActive, true),
    isNull(promotions.deletedAt),
    lt(promotions.startsAt, p.endsAt),
    gt(promotions.endsAt, p.startsAt),
  ];
  if (excludeId) where.push(ne(promotions.id, excludeId));
  const [clash] = await db.select({ label: promotions.label }).from(promotions).where(and(...where)).limit(1);
  if (clash) throw new AppError('BUSINESS_RULE', `This overlaps "${clash.label}". Change the dates or pause that sale first.`);
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Plans & Offers admin module (docs/admin/NAVIGATION.md §3): plans, prices and sale windows. */
export const adminPlanRoutes = new Hono<AppEnv>()
  .get('/plans', requireStaff('plans.view'), async (c) => {
    const { db } = c.get('deps');
    const now = new Date();
    const rows = await db.select().from(plans).where(isNull(plans.deletedAt)).orderBy(asc(plans.sortOrder), asc(plans.name));
    const ids = rows.map((p) => p.id);
    const [promos, enrolled] = ids.length
      ? await Promise.all([
          db
            .select()
            .from(promotions)
            .where(and(inArray(promotions.planId, ids), isNull(promotions.deletedAt), gt(promotions.endsAt, now)))
            .orderBy(asc(promotions.startsAt)),
          db
            .select({ planId: enrollments.planId, n: count() })
            .from(enrollments)
            .where(and(inArray(enrollments.planId, ids), liveEnrollment(now)))
            .groupBy(enrollments.planId),
        ])
      : [[], []];
    return c.json({
      data: rows.map((p) => {
        const mine = promos.filter((x) => x.planId === p.id);
        const running = mine.find((x) => promotionState(x, now) === 'running');
        const next = mine.find((x) => promotionState(x, now) === 'scheduled');
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          status: p.status,
          accessDays: p.accessDays,
          grantsAllCourses: p.grantsAllCourses,
          ...priceFor(p, running),
          compareAtPaise: p.compareAtPaise,
          nextPromotion: next ? promotionDto(next, now) : null,
          activeEnrollments: Number(enrolled.find((e) => e.planId === p.id)?.n ?? 0),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    });
  })

  /** Courses for the "which courses does this plan unlock" picker. */
  .get('/plans/courses', requireStaff('plans.view'), async (c) => {
    const { db } = c.get('deps');
    const rows = await db
      .select({ id: courses.id, title: courses.title, status: courses.status })
      .from(courses)
      .where(isNull(courses.deletedAt))
      .orderBy(asc(courses.sortOrder));
    return c.json({ data: rows });
  })

  .get('/plans/:id', requireStaff('plans.view'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const now = new Date();
    const p = await loadPlan(db, c.req.valid('param').id);
    const [courseRows, promoRows, [{ n }]] = await Promise.all([
      db.select({ courseId: planCourses.courseId }).from(planCourses).where(eq(planCourses.planId, p.id)),
      db
        .select()
        .from(promotions)
        .where(and(eq(promotions.planId, p.id), isNull(promotions.deletedAt)))
        .orderBy(desc(promotions.startsAt)),
      db.select({ n: count() }).from(enrollments).where(eq(enrollments.planId, p.id)),
    ]);
    const running = promoRows.find((x) => promotionState(x, now) === 'running');
    return c.json({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        currency: p.currency,
        pricePaise: p.pricePaise,
        compareAtPaise: p.compareAtPaise,
        features: p.features,
        mobileFeatureOrder: p.mobileFeatureOrder ?? null,
        grantsAllCourses: p.grantsAllCourses,
        courseIds: courseRows.map((r) => r.courseId),
        accessDays: p.accessDays,
        status: p.status,
        sortOrder: p.sortOrder,
        price: priceFor(p, running),
        promotions: promoRows.map((x) => promotionDto(x, now)),
        enrollments: Number(n),
        createdAt: p.createdAt.toISOString(),
        updatedAt: iso(p.updatedAt),
      },
    });
  })

  .post(
    '/plans',
    requireStaff('plans.add'),
    validate(
      'json',
      planFields
        .partial({ description: true, compareAtPaise: true, mobileFeatureOrder: true, courseIds: true, accessDays: true, sortOrder: true })
        .extend({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes').max(64) })
        .strict(),
    ),
    async (c) => {
      const { db } = c.get('deps');
      const input = c.req.valid('json');
      const p = { description: null, compareAtPaise: null, mobileFeatureOrder: null, courseIds: [], accessDays: null, sortOrder: 0, ...input };
      checkPlan(p);
      if (!p.grantsAllCourses) await assertCourses(db, p.courseIds);
      const [taken] = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, p.slug));
      if (taken) throw new AppError('CONFLICT', 'That slug is already used (slugs of deleted plans stay reserved)', { details: [{ path: 'slug', message: 'Already used' }] });

      const { courseIds, ...values } = p;
      const id = await db.transaction(async (tx) => {
        await tx.insert(plans).values(values);
        const [row] = await tx.select({ id: plans.id }).from(plans).where(eq(plans.slug, p.slug));
        if (!p.grantsAllCourses) await tx.insert(planCourses).values(courseIds.map((courseId) => ({ planId: row.id, courseId })));
        return row.id;
      });
      await logActivity(c, { action: 'plans.create', entityType: 'plan', entityId: id, metadata: { slug: p.slug, name: p.name, pricePaise: p.pricePaise, status: p.status } });
      return c.json({ data: { id } }, 201);
    },
  )

  /** Partial update. The slug never changes: the website looks plans up by it. */
  .patch('/plans/:id', requireStaff('plans.edit'), validate('param', idParam), validate('json', planFields.partial().strict()), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPlan(db, c.req.valid('param').id);
    const input = c.req.valid('json');
    const currentCourses = (await db.select({ courseId: planCourses.courseId }).from(planCourses).where(eq(planCourses.planId, p.id))).map((r) => r.courseId);
    const current = {
      name: p.name,
      description: p.description,
      pricePaise: p.pricePaise,
      compareAtPaise: p.compareAtPaise,
      features: p.features,
      mobileFeatureOrder: p.mobileFeatureOrder ?? null,
      grantsAllCourses: p.grantsAllCourses,
      courseIds: currentCourses,
      accessDays: p.accessDays,
      status: p.status,
      sortOrder: p.sortOrder,
    };
    const merged = { ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as typeof current;
    checkPlan(merged);

    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const changed = (Object.keys(current) as (keyof typeof current)[]).filter((k) =>
      k === 'courseIds' ? !same([...merged.courseIds].sort(), [...current.courseIds].sort()) : !same(merged[k], current[k]),
    );
    if (!changed.length) return c.json({ data: { ok: true, changed } });
    if (changed.includes('courseIds') && !merged.grantsAllCourses) await assertCourses(db, merged.courseIds);

    // A running sale must stay cheaper than the plan, or the site would silently drop it.
    if (changed.includes('pricePaise')) {
      const now = new Date();
      const [undercut] = await db
        .select({ label: promotions.label })
        .from(promotions)
        .where(and(eq(promotions.planId, p.id), isNull(promotions.deletedAt), eq(promotions.isActive, true), gt(promotions.endsAt, now), gt(promotions.salePricePaise, merged.pricePaise - 1)))
        .limit(1);
      if (undercut) throw new AppError('BUSINESS_RULE', `"${undercut.label}" has a sale price at or above this price. Change or pause that sale first.`);
    }

    const { courseIds, ...values } = merged;
    await db.transaction(async (tx) => {
      await tx.update(plans).set(values).where(eq(plans.id, p.id));
      if (changed.includes('courseIds') || changed.includes('grantsAllCourses')) {
        await tx.delete(planCourses).where(eq(planCourses.planId, p.id));
        if (!merged.grantsAllCourses) await tx.insert(planCourses).values(courseIds.map((courseId) => ({ planId: p.id, courseId })));
      }
    });
    const pick = (o: typeof current) => Object.fromEntries(changed.map((k) => [k, o[k]]));
    await logActivity(c, { action: 'plans.update', entityType: 'plan', entityId: p.id, metadata: { before: pick(current), after: pick(merged) } });
    return c.json({ data: { ok: true, changed } });
  })

  /** Soft delete, only for plans nobody was ever enrolled in (enrollments keep pointing at their plan). */
  .delete('/plans/:id', requireStaff('plans.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPlan(db, c.req.valid('param').id);
    const [{ n }] = await db.select({ n: count() }).from(enrollments).where(eq(enrollments.planId, p.id));
    if (Number(n) > 0) throw new AppError('BUSINESS_RULE', 'Students have been enrolled in this plan. Archive it instead.');
    await db.update(plans).set({ deletedAt: new Date(), status: 'archived' }).where(eq(plans.id, p.id));
    await logActivity(c, { action: 'plans.delete', entityType: 'plan', entityId: p.id, metadata: { slug: p.slug, name: p.name } });
    return c.json({ data: { ok: true } });
  })

  .post('/plans/:id/promotions', requireStaff('plans.edit'), validate('param', idParam), validate('json', promotionFields.strict()), async (c) => {
    const { db } = c.get('deps');
    const plan = await loadPlan(db, c.req.valid('param').id);
    const input = c.req.valid('json');
    await checkPromotion(db, plan, { ...input, isActive: true });
    const [row] = await db.insert(promotions).values({ planId: plan.id, ...input, createdBy: c.get('user')!.id }).$returningId();
    await logActivity(c, {
      action: 'plans.promotion_create',
      entityType: 'promotion',
      entityId: row.id,
      metadata: { planId: plan.id, label: input.label, salePricePaise: input.salePricePaise, startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() },
    });
    return c.json({ data: { id: row.id } }, 201);
  })

  /** Edit a sale, or pause / resume it with `isActive` (the kill switch). Ended sales are history. */
  .patch(
    '/promotions/:id',
    requireStaff('plans.edit'),
    validate('param', idParam),
    validate('json', promotionFields.partial().extend({ isActive: z.boolean().optional() }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const promo = await loadPromotion(db, c.req.valid('param').id);
      if (promo.endsAt <= new Date()) throw new AppError('BUSINESS_RULE', 'This sale has ended. Create a new one instead.');
      const plan = await loadPlan(db, promo.planId);
      const input = c.req.valid('json');
      const merged = {
        label: input.label ?? promo.label,
        salePricePaise: input.salePricePaise ?? promo.salePricePaise,
        startsAt: input.startsAt ?? promo.startsAt,
        endsAt: input.endsAt ?? promo.endsAt,
        isActive: input.isActive ?? promo.isActive,
      };
      await checkPromotion(db, plan, merged, promo.id);
      await db.update(promotions).set(merged).where(eq(promotions.id, promo.id));
      const action = input.isActive === false && promo.isActive ? 'plans.promotion_pause' : input.isActive === true && !promo.isActive ? 'plans.promotion_resume' : 'plans.promotion_update';
      const view = (x: typeof merged) => ({ ...x, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString() });
      await logActivity(c, { action, entityType: 'promotion', entityId: promo.id, metadata: { planId: plan.id, before: view(promo), after: view(merged) } });
      return c.json({ data: promotionDto({ ...promo, ...merged }, new Date()) });
    },
  )

  .delete('/promotions/:id', requireStaff('plans.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const promo = await loadPromotion(db, c.req.valid('param').id);
    await db.update(promotions).set({ deletedAt: new Date(), isActive: false }).where(eq(promotions.id, promo.id));
    await logActivity(c, { action: 'plans.promotion_delete', entityType: 'promotion', entityId: promo.id, metadata: { planId: promo.planId, label: promo.label } });
    return c.json({ data: { ok: true } });
  });
