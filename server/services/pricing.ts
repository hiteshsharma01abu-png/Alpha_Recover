import { and, asc, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import type { Database } from '../db';
import { plans, promotions } from '../db/schema';

export type PlanDto = {
  slug: string;
  name: string;
  description: string | null;
  currency: string;
  /** Base price. */
  pricePaise: number;
  /** What the buyer pays right now (sale price while a promotion runs). */
  effectivePricePaise: number;
  /** Strike-through price to show, or null when there's nothing to compare against. */
  comparePricePaise: number | null;
  discountPct: number;
  promotion: { label: string; startsAt: string; endsAt: string } | null;
  features: string[];
  mobileFeatureOrder: number[] | null;
  accessDays: number | null;
};

type PlanRow = typeof plans.$inferSelect;
type PromotionRow = typeof promotions.$inferSelect;

/**
 * Single source of truth for prices (docs/PRD.md FR-P3): checkout (Phase 5) must call this too,
 * never trust a client amount. A promotion applies when active, not deleted and now ∈ [starts, ends).
 */
export function priceFor(plan: PlanRow, promotion: PromotionRow | undefined): Omit<PlanDto, 'slug' | 'name' | 'description' | 'features' | 'mobileFeatureOrder' | 'accessDays' | 'currency'> {
  const sale = promotion && promotion.salePricePaise < plan.pricePaise ? promotion : undefined;
  const effective = sale ? sale.salePricePaise : plan.pricePaise;
  const compare = sale ? plan.pricePaise : plan.compareAtPaise && plan.compareAtPaise > plan.pricePaise ? plan.compareAtPaise : null;
  return {
    pricePaise: plan.pricePaise,
    effectivePricePaise: effective,
    comparePricePaise: compare,
    discountPct: compare ? Math.round(((compare - effective) / compare) * 100) : 0,
    promotion: sale ? { label: sale.label, startsAt: sale.startsAt.toISOString(), endsAt: sale.endsAt.toISOString() } : null,
  };
}

/** Published plans with their current price. */
export async function loadPlans(db: Database, opts: { slug?: string; now?: Date } = {}): Promise<PlanDto[]> {
  const now = opts.now ?? new Date();
  const planRows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.status, 'published'), isNull(plans.deletedAt), opts.slug ? eq(plans.slug, opts.slug) : undefined))
    .orderBy(asc(plans.sortOrder));
  if (!planRows.length) return [];

  const running = await db
    .select()
    .from(promotions)
    .where(
      and(
        inArray(promotions.planId, planRows.map((p) => p.id)),
        eq(promotions.isActive, true),
        isNull(promotions.deletedAt),
        lte(promotions.startsAt, now),
        gt(promotions.endsAt, now),
      ),
    )
    // If an admin ever overlaps two sales, the one ending soonest wins (overlaps are rejected on create).
    .orderBy(asc(promotions.endsAt));

  return planRows.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    currency: plan.currency,
    features: plan.features,
    mobileFeatureOrder: plan.mobileFeatureOrder ?? null,
    accessDays: plan.accessDays,
    ...priceFor(plan, running.find((p) => p.planId === plan.id)),
  }));
}
