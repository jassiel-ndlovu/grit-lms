/**
 * AI credit arithmetic (#216; owner decisions 22 Nov). Pure: the check
 * script covers it.
 *
 * Provisional numbers, to be set from real usage (the owner's tracker,
 * "AI credits"): 1 credit = R0.01 of Nexa's AI cost; Pro seats bring 500
 * included credits a period (R5), Plus 150 (R1.50), Core none; a trial
 * gets 300 once. Bought credits carry a 5% markup (provisional).
 */

export const AI_CREDITS = {
  /** Rand cents of Nexa's cost per credit. */
  centsPerCredit: 1,
  includedPerSeat: { CORE: 0, PLUS: 150, PRO: 500 } as Record<"CORE" | "PLUS" | "PRO", number>,
  trialCredits: 300,
  /** Superseded by topup-math.ts (8–15%, default 12%; owner, 24 Nov). Kept for purchasePriceCents. */
  markupBps: 1200,
  /** Warn the person and their managers at this share used (80%). */
  warnAtBps: 8000,
} as const;

/** Credits for a provider cost in millionths of a US dollar: at least 1, rounded up. */
export function creditsForCost(costMicroUsd: number, zarPerUsd: number): number {
  const cents = (costMicroUsd / 1_000_000) * zarPerUsd * 100;
  return Math.max(1, Math.ceil(cents / AI_CREDITS.centsPerCredit));
}

/** Included credits for a period from its seat charges, one row per paid seat. */
export function includedCreditsFor(seats: Array<{ tierKey: "CORE" | "PLUS" | "PRO" }>): number {
  return seats.reduce((n, s) => n + (AI_CREDITS.includedPerSeat[s.tierKey] ?? 0), 0);
}

/** The price in rand cents of `credits` bought: cost plus the markup. */
export function purchasePriceCents(credits: number): number {
  return Math.ceil(credits * AI_CREDITS.centsPerCredit * (1 + AI_CREDITS.markupBps / 10_000));
}

export type Balances = {
  /** Left in the current included grant (0 when none). */
  included: number;
  bought: number;
  /** The spender's own credits (only counted when the organisation allows them). */
  personal: number;
  /** How much more of the organisation's credits the spender may use this month; null = no personal limit. */
  allowanceLeft: number | null;
  personalAllowed: boolean;
};

export type SpendPlan = { ok: true; parts: Array<{ pool: "INCLUDED" | "BOUGHT" | "PERSONAL"; credits: number }> } | { ok: false; reason: "ALLOWANCE" | "EMPTY" };

/**
 * Where `need` credits come from, in the decided order: the organisation's
 * included pool, then its bought credits (both within the person's
 * allowance), then the person's own credits if the organisation allows.
 */
export function planSpend(b: Balances, need: number): SpendPlan {
  const parts: Array<{ pool: "INCLUDED" | "BOUGHT" | "PERSONAL"; credits: number }> = [];
  let left = need;
  let orgRoom = b.allowanceLeft === null ? Infinity : Math.max(0, b.allowanceLeft);
  const take = (pool: "INCLUDED" | "BOUGHT" | "PERSONAL", available: number, cap: number) => {
    const n = Math.min(left, Math.max(0, available), cap);
    if (n > 0) { parts.push({ pool, credits: n }); left -= n; }
    return n;
  };
  orgRoom -= take("INCLUDED", b.included, orgRoom);
  take("BOUGHT", b.bought, orgRoom);
  if (left > 0 && b.personalAllowed) take("PERSONAL", b.personal, Infinity);
  if (left > 0) {
    // The person's allowance stopped it when the organisation still had more than they were allowed.
    const blockedByAllowance = b.allowanceLeft !== null && b.included + b.bought > Math.max(0, b.allowanceLeft);
    return { ok: false, reason: blockedByAllowance ? "ALLOWANCE" : "EMPTY" };
  }
  return { ok: true, parts };
}

/** True when `used` has reached the warning share of `total`. */
export function pastWarning(used: number, total: number): boolean {
  return total > 0 && used * 10_000 >= total * AI_CREDITS.warnAtBps;
}
