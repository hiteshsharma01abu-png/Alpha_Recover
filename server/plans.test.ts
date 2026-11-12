import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { pricing } from '../src/data/content';
import { plans, promotions } from './db/schema';
import { seedPlans } from './db/seed';
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
    await seedPlans(ctx.db);
  });

  it('seeds the Professional Plan at ₹5,999 with the Festival Sale at ₹2,500 ending 30 Nov 2026 11:59 PM IST', async () => {
    const [plan] = await ctx.db.select().from(plans);
    expect(plan).toMatchObject({ slug: 'professional', pricePaise: 599900, currency: 'INR', status: 'published' });
    expect(plan.features).toEqual(pricing.features);
    const [promo] = await ctx.db.select().from(promotions);
    expect(promo).toMatchObject({ salePricePaise: 250000, label: 'Festival Sale – Up to 60% Off', isActive: true });
    expect(promo.endsAt.toISOString()).toBe('2026-11-30T18:29:59.000Z');
  });

  it('is insert-only: re-running adds no plan or promotion', async () => {
    expect(await seedPlans(ctx.db)).toEqual({ plans: 0, promotions: 0 });
    expect(await ctx.db.$count(promotions)).toBe(1);
  });

  it('prices by time: full before the sale, sale price during, full again after', async () => {
    const at = (iso: string) => loadPlans(ctx.db, { now: new Date(iso) }).then(([p]) => p);
    expect((await at('2026-10-31T12:00:00Z')).effectivePricePaise).toBe(599900);
    const during = await at('2026-11-15T12:00:00Z');
    expect(during).toMatchObject({ effectivePricePaise: 250000, comparePricePaise: 599900, discountPct: 58 });
    expect(during.promotion?.endsAt).toBe('2026-11-30T18:29:59.000Z');
    expect((await at('2026-11-30T18:29:58Z')).effectivePricePaise).toBe(250000);
    const after = await at('2026-11-30T18:29:59Z');
    expect(after).toMatchObject({ effectivePricePaise: 599900, promotion: null, comparePricePaise: null });
  });

  it('ignores disabled or deleted promotions', async () => {
    const mid = new Date('2026-11-15T12:00:00Z');
    await ctx.db.update(promotions).set({ isActive: false });
    expect((await loadPlans(ctx.db, { now: mid }))[0].effectivePricePaise).toBe(599900);
    await ctx.db.update(promotions).set({ isActive: true, deletedAt: new Date() });
    expect((await loadPlans(ctx.db, { now: mid }))[0].effectivePricePaise).toBe(599900);
  });

  it('GET /plans/professional returns the live price with a short cache', async () => {
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
    expect(list.data).toHaveLength(1);
  });

  it('404s for unknown or draft plans', async () => {
    expect((await ctx.app.request('/api/v1/plans/nope')).status).toBe(404);
    await ctx.db.update(plans).set({ status: 'draft' }).where(eq(plans.slug, 'professional'));
    expect((await ctx.app.request('/api/v1/plans/professional')).status).toBe(404);
  });
});
