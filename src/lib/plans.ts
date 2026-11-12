import { useEffect, useState } from 'react';
import { pricing } from '../data/content';
import { api } from './api';

/** Mirrors the API's PlanDto (server/services/pricing.ts). Amounts are in paise. */
export type Plan = {
  slug: string;
  name: string;
  currency: string;
  pricePaise: number;
  effectivePricePaise: number;
  comparePricePaise: number | null;
  discountPct: number;
  promotion: { label: string; startsAt: string; endsAt: string } | null;
  features: string[];
  mobileFeatureOrder: number[] | null;
};

/** Offline fallback built from content.ts, applying the same sale window rules as the server. */
export function staticPlan(now: number): Plan {
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
  };
}

/** The plan once its sale has ended: base price, nothing to compare, no promotion. */
export function withoutSale(plan: Plan): Plan {
  return { ...plan, effectivePricePaise: plan.pricePaise, comparePricePaise: null, discountPct: 0, promotion: null };
}

const requests = new Map<string, Promise<Plan | null>>();

function fetchPlan(slug: string) {
  let req = requests.get(slug);
  if (!req) {
    req = api
      .get<Plan>(`/plans/${slug}`)
      .then((res) => res.data)
      .catch(() => null);
    requests.set(slug, req);
  }
  return req;
}

/** Plan with live pricing from the API; renders the content.ts fallback until (or unless) it answers. */
export function usePlan(slug = 'professional'): Plan {
  const [plan, setPlan] = useState<Plan>(() => staticPlan(Date.now()));
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
