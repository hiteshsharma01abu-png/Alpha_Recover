import { useEffect, useState } from 'react';
import { pricing } from '../data/content';
import { pricingPlans, type StaticPlanDef } from '../data/pricingPlans';
import { api } from './api';

/** Mirrors the API's PlanDto (server/services/pricing.ts). Amounts are in paise. */
export type Plan = {
  slug: string;
  name: string;
  description?: string | null;
  currency: string;
  pricePaise: number;
  effectivePricePaise: number;
  comparePricePaise: number | null;
  discountPct: number;
  promotion: { label: string; startsAt: string; endsAt: string } | null;
  features: string[];
  mobileFeatureOrder: number[] | null;
  /** UI-only: from static catalog when API omits it. */
  comingSoon?: boolean;
  recommended?: boolean;
  tagline?: string;
  audience?: string;
  ctaLabel?: string;
};

function applySaleWindow(def: StaticPlanDef, now: number): Plan {
  const onSale =
    def.saleInr != null &&
    def.saleStartsAt != null &&
    def.saleEndsAt != null &&
    def.saleLabel != null &&
    now >= Date.parse(def.saleStartsAt) &&
    now < Date.parse(def.saleEndsAt) &&
    def.saleInr < def.priceInr;
  const effectiveInr = onSale ? def.saleInr! : def.priceInr;
  const compareInr = onSale ? def.priceInr : null;
  return {
    slug: def.slug,
    name: def.name,
    description: def.audience,
    currency: 'INR',
    pricePaise: def.priceInr * 100,
    effectivePricePaise: effectiveInr * 100,
    comparePricePaise: compareInr != null ? compareInr * 100 : null,
    discountPct: compareInr ? Math.round(((compareInr - effectiveInr) / compareInr) * 100) : 0,
    promotion: onSale
      ? {
          label: def.saleLabel!,
          startsAt: new Date(Date.parse(def.saleStartsAt!)).toISOString(),
          endsAt: new Date(Date.parse(def.saleEndsAt!)).toISOString(),
        }
      : null,
    features: def.features,
    mobileFeatureOrder: def.mobileFeatureOrder,
    comingSoon: def.comingSoon,
    recommended: def.recommended,
    tagline: def.tagline,
    audience: def.audience,
    ctaLabel: def.ctaLabel,
  };
}

/** Offline fallback for one plan (Professional keeps the historical content.ts window). */
export function staticPlan(now: number, slug = 'professional'): Plan {
  const def = pricingPlans.find((p) => p.slug === slug);
  if (def) return applySaleWindow(def, now);
  // Legacy path if slug missing from pricingPlans
  const start = Date.parse(pricing.saleStartsAt);
  const end = Date.parse(pricing.saleEndsAt);
  const onSale = now >= start && now < end && pricing.now < pricing.was;
  return {
    slug: 'professional',
    name: pricing.name,
    currency: pricing.currency,
    pricePaise: pricing.was * 100,
    effectivePricePaise: (onSale ? pricing.now : pricing.was) * 100,
    comparePricePaise: onSale ? pricing.was * 100 : null,
    discountPct: onSale ? Math.round(((pricing.was - pricing.now) / pricing.was) * 100) : 0,
    promotion: onSale
      ? { label: pricing.saleLabel, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }
      : null,
    features: pricing.features,
    mobileFeatureOrder: pricing.mobileFeatureOrder,
    recommended: true,
    ctaLabel: 'Enroll Now',
  };
}

export function staticPlans(now = Date.now()): Plan[] {
  return pricingPlans.map((d) => applySaleWindow(d, now));
}

/** The plan once its sale has ended: base price, nothing to compare, no promotion. */
export function withoutSale(plan: Plan): Plan {
  return { ...plan, effectivePricePaise: plan.pricePaise, comparePricePaise: null, discountPct: 0, promotion: null };
}

const requests = new Map<string, Promise<Plan | null>>();
let listRequest: Promise<Plan[] | null> | null = null;

function enrich(live: Plan, slug: string): Plan {
  const def = pricingPlans.find((p) => p.slug === slug);
  return {
    ...live,
    comingSoon: def?.comingSoon,
    recommended: def?.recommended,
    tagline: def?.tagline,
    audience: def?.audience ?? live.description ?? undefined,
    ctaLabel: def?.ctaLabel,
  };
}

function fetchPlan(slug: string) {
  let req = requests.get(slug);
  if (!req) {
    req = api
      .get<Plan>(`/plans/${slug}`)
      .then((res) => enrich(res.data, slug))
      .catch(() => null);
    requests.set(slug, req);
  }
  return req;
}

function fetchPlans() {
  if (!listRequest) {
    listRequest = api
      .get<Plan[]>('/plans')
      .then((res) => {
        const bySlug = new Map(res.data.map((p) => [p.slug, enrich(p, p.slug)]));
        // Keep static order; drop unknown API-only plans after known ones
        const ordered = pricingPlans.map((d) => bySlug.get(d.slug) ?? applySaleWindow(d, Date.now()));
        for (const [slug, plan] of bySlug) {
          if (!pricingPlans.some((d) => d.slug === slug)) ordered.push(plan);
        }
        return ordered;
      })
      .catch(() => null);
  }
  return listRequest;
}

/** Plan with live pricing from the API; renders the content.ts fallback until (or unless) it answers. */
export function usePlan(slug = 'professional'): Plan {
  const [plan, setPlan] = useState<Plan>(() => staticPlan(Date.now(), slug));
  useEffect(() => {
    let active = true;
    void fetchPlan(slug).then((live) => {
      if (active && live) setPlan(live);
    });
    return () => {
      active = false;
    };
  }, [slug]);
  return plan;
}

/** All published plans for the pricing page (static fallback → live GET /plans). */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(() => staticPlans());
  useEffect(() => {
    let active = true;
    void fetchPlans().then((live) => {
      if (active && live?.length) setPlans(live);
    });
    return () => {
      active = false;
    };
  }, []);
  return plans;
}
