/**
 * Plan prices for the landing page (#216): the pure part, so the check
 * script covers it. The database read is ./plans.ts.
 */

import { AI_CREDITS } from "@/features/ai-credits/credits-math";
import { SERVICES, TIER_KEYS, TIER_RANK, type TierKey } from "@/features/billing/catalogue";

export type PublicPlan = {
  key: TierKey;
  name: string;
  /** Rand cents, excl. VAT, per active student per course per 30 days. */
  priceCents: number;
  /** "R139" (whole rands) or "R139.50". */
  priceLabel: string;
  /** Included AI credits a seat brings each period (provisional). */
  aiCreditsPerSeat: number;
  /** Services this plan adds over the plan below it (v1 only). */
  adds: string[];
  /** Every v1 service on this plan, the lower plans' included. */
  includes: string[];
};

export type PublicPlans = {
  live: boolean;
  currency: "ZAR";
  unit: string;
  vatNote: string;
  trialDays: number;
  plans: PublicPlan[];
};

export const TRIAL_DAYS = 14;

export function randLabel(cents: number): string {
  return cents % 100 === 0 ? `R${cents / 100}` : `R${(cents / 100).toFixed(2)}`;
}

/** Pure: builds the plans from tier rows (the check script covers it). */
export function buildPublicPlans(tiers: Array<{ key: TierKey; name: string; priceCents: number }>, live: boolean): PublicPlans {
  const v1 = Object.values(SERVICES).filter((s) => s.status === "v1");
  const plans = TIER_KEYS.flatMap((key) => {
    const t = tiers.find((r) => r.key === key);
    if (!t) return [];
    return [{
      key,
      name: t.name,
      priceCents: t.priceCents,
      priceLabel: randLabel(t.priceCents),
      aiCreditsPerSeat: AI_CREDITS.includedPerSeat[key] ?? 0,
      adds: v1.filter((s) => s.tier === key).map((s) => s.name),
      includes: v1.filter((s) => TIER_RANK[s.tier] <= TIER_RANK[key]).map((s) => s.name),
    }];
  });
  return {
    live,
    currency: "ZAR",
    unit: "per active student, per course, per 30 days",
    vatNote: "Prices exclude VAT.",
    trialDays: TRIAL_DAYS,
    plans,
  };
}
