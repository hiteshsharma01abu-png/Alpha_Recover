import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { pricing } from '../src/data/content';
import { PROFESSIONAL_FEATURES } from '../src/data/pricingPlans';
import { planCourses, plans, promotions } from './db/schema';
import { seedCatalog, seedPlans } from './db/seed';
import { loadPlans, priceFor } from './services/pricing';
import { createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe('priceFor (pure)', () => {
  const plan = { pricePaise: 599900, compareAtPaise: null } as Parameters<typeof priceFor>[0];
  const promo = (salePricePaise: number) =>
    ({ salePricePaise, label: 'Sale', startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-12-01T00:00:00Z') }) as Parameters<typeof priceFor>[1];

  it('charges the base price with no promotion', () => {
    expect(priceFor(plan, undefined)).toMatchObject({ effectivePricePaise: 599900, comparePricePaise: null, discountPct: 0, promotion: null });
  });

  it('applies a promotion and strikes through the base price', () => {
    expect(priceFor(plan, promo(250000))).toMatchObject({
      effectivePricePaise: 250000,
      comparePricePaise: 599900,
      discountPct: 58,
      promotion: { label: 'Sale', endsAt: '2026-12-01T00:00:00.000Z' },
    });
  });

  it('ignores a "promotion" that is not cheaper', () => {
    expect(priceFor(plan, promo(700000)).effectivePricePaise).toBe(599900);
  });

  it('uses compare-at as the strike-through price when there is no promotion', () => {
    expect(priceFor({ ...plan, compareAtPaise: 799900 }, undefined)).toMatchObject({ comparePricePaise: 799900, discountPct: 25 });
  });
});

describe.skipIf(!dbAvailable)('plans & promotions (MySQL)', () => {
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

  async function professionalDto(now: Date) {
    const list = await loadPlans(ctx.db, { now });
    return list.find((p) => p.slug === 'professional')!;
  }

  it('seeds Essential, Professional and Expert with Festival Sale on Professional', async () => {
    const rows = await ctx.db.select().from(plans);
    expect(rows.map((r) => r.slug).sort()).toEqual(['essential', 'expert', 'professional']);

    const [pro] = await ctx.db.select().from(plans).where(eq(plans.slug, 'professional'));
    expect(pro).toMatchObject({ slug: 'professional', pricePaise: 599900, currency: 'INR', status: 'published', grantsAllCourses: true });
    expect(pro.features).toEqual(PROFESSIONAL_FEATURES);
    expect(pro.features).toEqual(pricing.features);

    const [essential] = await ctx.db.select().from(plans).where(eq(plans.slug, 'essential'));
    expect(essential).toMatchObject({ pricePaise: 99900, grantsAllCourses: false });
    expect(await ctx.db.$count(planCourses, eq(planCourses.planId, essential.id))).toBe(3);

    const [expert] = await ctx.db.select().from(plans).where(eq(plans.slug, 'expert'));
    expect(expert).toMatchObject({ pricePaise: 499900, grantsAllCourses: true });

    const [promo] = await ctx.db.select().from(promotions);
    expect(promo).toMatchObject({ salePricePaise: 250000, label: 'Festival Sale – Up to 60% Off', isActive: true });
    expect(promo.endsAt.toISOString()).toBe('2026-11-30T18:29:59.000Z');
  });

  it('is insert-only: re-running adds no plan or promotion', async () => {
    expect(await seedPlans(ctx.db)).toEqual({ plans: 0, promotions: 0, planCourses: 0 });
    expect(await ctx.db.$count(promotions)).toBe(1);
  });

  it('prices Professional by time: full before the sale, sale price during, full again after', async () => {
    expect((await professionalDto(new Date('2026-10-31T12:00:00Z'))).effectivePricePaise).toBe(599900);
    const during = await professionalDto(new Date('2026-11-15T12:00:00Z'));
    expect(during).toMatchObject({ effectivePricePaise: 250000, comparePricePaise: 599900, discountPct: 58 });
    expect(during.promotion?.endsAt).toBe('2026-11-30T18:29:59.000Z');
    expect((await professionalDto(new Date('2026-11-30T18:29:58Z'))).effectivePricePaise).toBe(250000);
    const after = await professionalDto(new Date('2026-11-30T18:29:59Z'));
    expect(after).toMatchObject({ effectivePricePaise: 599900, promotion: null, comparePricePaise: null });
  });

  it('ignores disabled or deleted promotions on Professional', async () => {
    const mid = new Date('2026-11-15T12:00:00Z');
    await ctx.db.update(promotions).set({ isActive: false });
    expect((await professionalDto(mid)).effectivePricePaise).toBe(599900);
    await ctx.db.update(promotions).set({ isActive: true, deletedAt: new Date() });
    expect((await professionalDto(mid)).effectivePricePaise).toBe(599900);
  });

  it('GET /plans returns three published slugs; /plans/professional has live sale price', async () => {
    const now = Date.now();
    await ctx.db
      .update(promotions)
      .set({ startsAt: new Date(now - 3_600_000), endsAt: new Date(now + 3_600_000) });
    const res = await ctx.app.request('/api/v1/plans/professional');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
    const { data } = await readJson(res);
    expect(data).toMatchObject({ slug: 'professional', effectivePricePaise: 250000, pricePaise: 599900 });
    expect(data.mobileFeatureOrder).toEqual(pricing.mobileFeatureOrder);

    const list = await readJson(await ctx.app.request('/api/v1/plans'));
    expect(list.data).toHaveLength(3);
    expect(list.data.map((p: { slug: string }) => p.slug)).toEqual(['essential', 'professional', 'expert']);
  });

  it('404s for unknown or draft plans', async () => {
    expect((await ctx.app.request('/api/v1/plans/nope')).status).toBe(404);
    await ctx.db.update(plans).set({ status: 'draft' }).where(eq(plans.slug, 'professional'));
    expect((await ctx.app.request('/api/v1/plans/professional')).status).toBe(404);
  });
});
