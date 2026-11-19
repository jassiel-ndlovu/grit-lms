/**
 * Pure pricing for Gate 1 billing (docs/revamp/a/design/03-billing.md,
 * sections 2 to 4 and 8). No database, no env, no clock: every input is
 * passed in, so scripts/check-billing.ts can prove the worked examples.
 *
 * Money is integer ZAR cents. Periods are [start, end), end exclusive.
 */

import { SERVICES, TIER_RANK, isServiceKey, type TierKey } from "./catalogue";

export type Prices = Record<TierKey, number>;

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------------- */
/* Tiers                                                                      */
/* ------------------------------------------------------------------------- */

export function maxTier(...tiers: Array<TierKey | null | undefined>): TierKey {
  let best: TierKey = "CORE";
  for (const t of tiers) if (t && TIER_RANK[t] > TIER_RANK[best]) best = t;
  return best;
}

export function tierAbove(a: TierKey, b: TierKey): boolean {
  return TIER_RANK[a] > TIER_RANK[b];
}

/**
 * The highest tier among the course's enabled premium services whose status
 * is v1. Parked, later and unknown keys never count. Else CORE.
 */
export function derivedTier(enabledKeys: Iterable<string>): TierKey {
  let best: TierKey = "CORE";
  for (const key of enabledKeys) {
    if (!isServiceKey(key)) continue;
    const s = SERVICES[key];
    if (s.kind !== "premium" || s.status !== "v1") continue;
    best = maxTier(best, s.tier);
  }
  return best;
}

export type TierHoldInput = { tierKey: TierKey; raisedAt?: Date; holdUntil: Date };
export type TierOverrideInput = { tierKey: TierKey; until: Date | null } | null;

function overrideActive(o: TierOverrideInput, at: Date): o is NonNullable<TierOverrideInput> {
  return o != null && (o.until == null || o.until.getTime() > at.getTime());
}

/** Override if active, else the highest of the derived tier and every hold still running at `at`. */
export function billedTier(input: {
  derived: TierKey;
  holds: readonly TierHoldInput[];
  override: TierOverrideInput;
  at: Date;
}): TierKey {
  if (overrideActive(input.override, input.at)) return input.override.tierKey;
  const live = input.holds.filter((h) => h.holdUntil.getTime() > input.at.getTime()).map((h) => h.tierKey);
  return maxTier(input.derived, ...live);
}

/**
 * The highest tier a course was billed at during [start, end): the tier at
 * the start plus every hold that overlapped the period (every raise writes
 * a hold, so no raise is missed).
 */
export function highestTierDuring(input: {
  tierAtStart: TierKey;
  holds: readonly TierHoldInput[];
  override: TierOverrideInput;
  start: Date;
  end: Date;
}): TierKey {
  if (overrideActive(input.override, input.start)) return input.override.tierKey;
  const overlapping = input.holds
    .filter((h) => (h.raisedAt ?? input.start).getTime() < input.end.getTime() && h.holdUntil.getTime() > input.start.getTime())
    .map((h) => h.tierKey);
  return maxTier(input.tierAtStart, ...overlapping);
}

/**
 * The date a course's billed tier is held until, for "billed at Pro until
 * 12 March": the latest running hold at the billed tier. Null when no hold
 * is running at that tier (the tier is simply what is switched on).
 */
export function holdUntilFor(input: {
  billed: TierKey;
  holds: readonly TierHoldInput[];
  at: Date;
}): Date | null {
  let best: Date | null = null;
  for (const h of input.holds) {
    if (h.tierKey !== input.billed || h.holdUntil.getTime() <= input.at.getTime()) continue;
    if (!best || h.holdUntil.getTime() > best.getTime()) best = h.holdUntil;
  }
  return best;
}

/* ------------------------------------------------------------------------- */
/* Periods                                                                    */
/* ------------------------------------------------------------------------- */

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export type PeriodDates = { start: Date; end: Date; renewsAt: Date };

/** A payment at `paidAt` buys [paidAt, paidAt + periodDays); renewal is due at the end. */
export function periodFromPayment(paidAt: Date, periodDays = 30): PeriodDates {
  const end = addDays(paidAt, periodDays);
  return { start: paidAt, end, renewsAt: end };
}

/** Whole days left until `until`, rounded up, never negative. */
export function daysLeft(until: Date, now: Date): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY_MS));
}

/* ------------------------------------------------------------------------- */
/* AI marks overage (pass-through at cost ÷ margin)                           */
/* ------------------------------------------------------------------------- */

/**
 * Cents for `excessMarks` at the average cost of the period's marks, divided
 * by the margin: ceil(excess × (cost / marks) ÷ 1000 ÷ (marginBps / 10000)).
 * Costs are milli-cents.
 */
export function aiOverageCents(input: {
  excessMarks: number;
  totalMarks: number;
  totalCostMilliCents: number;
  apiMarginBps: number;
}): number {
  const { excessMarks, totalMarks, totalCostMilliCents, apiMarginBps } = input;
  if (excessMarks <= 0 || totalMarks <= 0 || totalCostMilliCents <= 0) return 0;
  return Math.ceil((excessMarks * totalCostMilliCents * 10) / (totalMarks * apiMarginBps));
}

/* ------------------------------------------------------------------------- */
/* Period invoice                                                             */
/* ------------------------------------------------------------------------- */

export type LineKind =
  | "ADVANCE" | "CATCH_UP" | "TIER_UPGRADE" | "ADDON" | "PASS_THROUGH"
  | "DISCOUNT" | "CREDIT" | "COMP" | "VAT";

export type InvoiceLineDraft = {
  kind: LineKind;
  courseId: string | null;
  courseTitle: string | null;
  tierKey: TierKey | null;
  serviceKey: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};

/** A course at the start of the new period. */
export type AdvanceCourseInput = {
  courseId: string;
  title: string;
  /** billedTier(course, t). */
  tier: TierKey;
  /** Learners with an ACTIVE enrolment at t. Duplicates are ignored. */
  learnerIds: readonly string[];
};

/** A course in the period being closed (billed in arrears). */
export type ClosingCourseInput = {
  courseId: string;
  title: string;
  /** highestTierDuring(...) for the closing period. */
  highestTier: TierKey;
  /** Every learner whose enrolment interval overlapped the period. */
  overlappingLearnerIds: readonly string[];
  /** SeatCharge rows already written for the period. */
  charged: ReadonlyArray<{ learnerId: string; tierKey: TierKey }>;
  /** AI_MARKS usage of this course in the period. */
  aiMarks?: { marks: number; costMilliCents: number };
};

export type DiscountInput = {
  discountCodeId: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  percentBps?: number | null;
  amountCents?: number | null;
  scope: "WORKSPACE_BILL" | "TIER" | "ADDON";
  scopeTierKey?: TierKey | null;
  scopeServiceKey?: string | null;
};

export type SeatChargeDraft = {
  period: "new" | "closing";
  courseId: string;
  learnerId: string;
  tierKey: TierKey;
  kind: "ADVANCE" | "CATCH_UP";
};

export type PeriodInvoiceDraft = {
  lines: InvoiceLineDraft[];
  seatCharges: SeatChargeDraft[];
  /** Existing SeatCharge rows in the closing period to move up to tierKey. */
  tierUpgrades: Array<{ courseId: string; learnerId: string; tierKey: TierKey }>;
  subtotalCents: number;
  discountCents: number;
  creditCents: number;
  vatCents: number;
  totalCents: number;
  /** Credit not used on this invoice; it stays OPEN. */
  creditLeftCents: number;
};

const unique = (ids: readonly string[]) => [...new Set(ids)];

/** round(base × bps / 10000) for PERCENT, min(amount, base) for FIXED. */
export function discountAmount(base: number, d: Pick<DiscountInput, "kind" | "percentBps" | "amountCents">): number {
  if (base <= 0) return 0;
  if (d.kind === "PERCENT") return Math.min(base, Math.round((base * (d.percentBps ?? 0)) / 10000));
  return Math.min(base, Math.max(0, d.amountCents ?? 0));
}

/**
 * The invoice that opens a period (seats in advance) and, if `closing` is
 * given, bills the previous period in arrears: catch-up seats, tier
 * upgrades and AI marks above the Pro pool. Then discount, credit and VAT.
 * Totals never go below zero.
 */
export function buildPeriodInvoice(input: {
  prices: Prices;
  advance: readonly AdvanceCourseInput[];
  closing?: readonly ClosingCourseInput[];
  /** From the PRO Tier row (30 in v1). */
  aiMarksPerStudent: number;
  apiMarginBps: number;
  discount?: DiscountInput | null;
  creditAvailableCents?: number;
  /** Only when Nexa is VAT-registered on the invoice date. */
  vatRateBps?: number | null;
}): PeriodInvoiceDraft {
  const { prices } = input;
  const lines: InvoiceLineDraft[] = [];
  const seatCharges: SeatChargeDraft[] = [];
  const tierUpgrades: PeriodInvoiceDraft["tierUpgrades"] = [];

  // 1. Seats in advance for the coming period.
  for (const c of input.advance) {
    const learners = unique(c.learnerIds);
    if (learners.length === 0) continue;
    const unit = prices[c.tier];
    lines.push({
      kind: "ADVANCE", courseId: c.courseId, courseTitle: c.title, tierKey: c.tier, serviceKey: null,
      description: `${c.title}, ${tierName(c.tier)}`, quantity: learners.length, unitPriceCents: unit,
      amountCents: learners.length * unit,
    });
    for (const learnerId of learners) {
      seatCharges.push({ period: "new", courseId: c.courseId, learnerId, tierKey: c.tier, kind: "ADVANCE" });
    }
  }

  // 2 and 3. Arrears for the closing period.
  for (const c of input.closing ?? []) {
    const charged = new Map<string, TierKey>();
    for (const s of c.charged) charged.set(s.learnerId, s.tierKey);
    const top = c.highestTier;

    const catchUp = unique(c.overlappingLearnerIds).filter((id) => !charged.has(id));
    if (catchUp.length > 0) {
      lines.push({
        kind: "CATCH_UP", courseId: c.courseId, courseTitle: c.title, tierKey: top, serviceKey: null,
        description: `${c.title}, ${catchUp.length === 1 ? "1 student" : `${catchUp.length} students`} added during the period`,
        quantity: catchUp.length, unitPriceCents: prices[top], amountCents: catchUp.length * prices[top],
      });
      for (const learnerId of catchUp) {
        seatCharges.push({ period: "closing", courseId: c.courseId, learnerId, tierKey: top, kind: "CATCH_UP" });
      }
    }

    // Tier upgrades, grouped by the tier each seat was charged at.
    const byFrom = new Map<TierKey, string[]>();
    for (const [learnerId, t] of charged) {
      if (!tierAbove(top, t)) continue;
      byFrom.set(t, [...(byFrom.get(t) ?? []), learnerId]);
    }
    for (const from of (["CORE", "PLUS"] as const)) {
      const ids = byFrom.get(from);
      if (!ids?.length) continue;
      const unit = prices[top] - prices[from];
      lines.push({
        kind: "TIER_UPGRADE", courseId: c.courseId, courseTitle: c.title, tierKey: top, serviceKey: null,
        description: `${c.title}, ${tierName(from)} to ${tierName(top)}`,
        quantity: ids.length, unitPriceCents: unit, amountCents: ids.length * unit,
      });
      for (const learnerId of ids) tierUpgrades.push({ courseId: c.courseId, learnerId, tierKey: top });
    }

    // AI marks above the Pro pool (30 per seat billed at Pro in the period).
    if (c.aiMarks && c.aiMarks.marks > 0) {
      const proSeats = top === "PRO" ? charged.size + catchUp.length : 0;
      const pool = proSeats * input.aiMarksPerStudent;
      const excess = Math.max(0, c.aiMarks.marks - pool);
      const amount = aiOverageCents({
        excessMarks: excess, totalMarks: c.aiMarks.marks,
        totalCostMilliCents: c.aiMarks.costMilliCents, apiMarginBps: input.apiMarginBps,
      });
      if (amount > 0) {
        lines.push({
          kind: "PASS_THROUGH", courseId: c.courseId, courseTitle: c.title, tierKey: null, serviceKey: "ai-marking",
          description: `${c.title}, ${excess} AI marks above the ${pool} included`,
          quantity: 1, unitPriceCents: amount, amountCents: amount,
        });
      }
    }
  }

  const subtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);

  // Discount.
  let discountCents = 0;
  const d = input.discount;
  if (d) {
    const base =
      d.scope === "WORKSPACE_BILL" ? subtotalCents
      : d.scope === "TIER" ? lines
          .filter((l) => (l.kind === "ADVANCE" || l.kind === "CATCH_UP" || l.kind === "TIER_UPGRADE") && l.tierKey === d.scopeTierKey)
          .reduce((s, l) => s + l.amountCents, 0)
      : lines.filter((l) => l.serviceKey != null && l.serviceKey === d.scopeServiceKey).reduce((s, l) => s + l.amountCents, 0);
    discountCents = discountAmount(base, d);
    if (discountCents > 0) {
      lines.push({
        kind: "DISCOUNT", courseId: null, courseTitle: null, tierKey: null, serviceKey: null,
        description: `Discount ${d.code}`, quantity: 1, unitPriceCents: -discountCents, amountCents: -discountCents,
      });
    }
  }

  // Credit: never takes the total below zero; the rest stays open.
  const afterDiscount = subtotalCents - discountCents;
  const creditAvailable = Math.max(0, input.creditAvailableCents ?? 0);
  const creditCents = Math.min(creditAvailable, Math.max(0, afterDiscount));
  if (creditCents > 0) {
    lines.push({
      kind: "CREDIT", courseId: null, courseTitle: null, tierKey: null, serviceKey: null,
      description: "Credit", quantity: 1, unitPriceCents: -creditCents, amountCents: -creditCents,
    });
  }

  const taxable = Math.max(0, afterDiscount - creditCents);
  const vatCents = input.vatRateBps ? Math.round((taxable * input.vatRateBps) / 10000) : 0;
  if (vatCents > 0) {
    lines.push({
      kind: "VAT", courseId: null, courseTitle: null, tierKey: null, serviceKey: null,
      description: `VAT ${input.vatRateBps! / 100}%`, quantity: 1, unitPriceCents: vatCents, amountCents: vatCents,
    });
  }

  return {
    lines,
    seatCharges,
    tierUpgrades,
    subtotalCents,
    discountCents,
    creditCents,
    vatCents,
    totalCents: taxable + vatCents,
    creditLeftCents: creditAvailable - creditCents,
  };
}

/* ------------------------------------------------------------------------- */
/* Service change preview (billing.md, previewServiceChange)                  */
/* ------------------------------------------------------------------------- */

export type ServiceChangePreview = {
  fromTier: TierKey;
  toTier: TierKey;
  seats: number;
  /** Extra arrears on the next renewal for this period: tier upgrades and catch-ups at the new tier. */
  catchUpCents: number;
  /** Total change to the next renewal invoice: the advance seats plus catchUpCents. */
  nextRenewalDeltaCents: number;
  /** When the course's billed tier after the change is held: a new hold, or one already running. */
  holdUntil: Date | null;
};

/** The enabled set after applying enable then disable. */
export function applyServiceChange(enabled: Iterable<string>, enable: readonly string[], disable: readonly string[]): Set<string> {
  const out = new Set(enabled);
  for (const k of enable) out.add(k);
  for (const k of disable) out.delete(k);
  return out;
}

/**
 * What switching services would do to a course's bill. Pure: the caller
 * loads the enabled keys, holds, override, seats and the open period.
 * A raise of the derived tier writes a hold for `holdDays` (not in TRIAL).
 */
export function previewServiceChange(input: {
  prices: Prices;
  at: Date;
  inTrial: boolean;
  enabled: Iterable<string>;
  enable: readonly string[];
  disable: readonly string[];
  holds: readonly TierHoldInput[];
  override: TierOverrideInput;
  /** Learners with an ACTIVE enrolment now. */
  seats: number;
  /** The open period, or null in the trial or between periods. */
  period: null | {
    start: Date;
    renewsAt: Date;
    tierAtStart: TierKey;
    /** SeatCharge tiers already written for this course in the period. */
    charged: readonly TierKey[];
    /** Learners in the period without a SeatCharge yet. */
    pendingCatchUpSeats: number;
  };
  holdDays?: number;
}): ServiceChangePreview {
  const holdDays = input.holdDays ?? 30;
  const before = [...input.enabled];
  const oldDerived = derivedTier(before);
  const newDerived = derivedTier(applyServiceChange(before, input.enable, input.disable));
  const raised = !input.inTrial && tierAbove(newDerived, oldDerived);
  const holdUntil = raised ? addDays(input.at, holdDays) : null;
  const newHolds = holdUntil ? [...input.holds, { tierKey: newDerived, raisedAt: input.at, holdUntil }] : input.holds;

  const fromTier = billedTier({ derived: oldDerived, holds: input.holds, override: input.override, at: input.at });
  const toTier = billedTier({ derived: newDerived, holds: newHolds, override: input.override, at: input.at });
  const p = input.prices;

  let catchUpCents = 0;
  let nextRenewalDeltaCents: number;
  if (input.period) {
    const end = input.period.renewsAt;
    const highBefore = highestTierDuring({ tierAtStart: input.period.tierAtStart, holds: input.holds, override: input.override, start: input.period.start, end });
    const highAfter = maxTier(highBefore, toTier);
    for (const t of input.period.charged) {
      catchUpCents += Math.max(0, p[highAfter] - p[t]) - Math.max(0, p[highBefore] - p[t]);
    }
    catchUpCents += input.period.pendingCatchUpSeats * (p[highAfter] - p[highBefore]);

    const renewBefore = billedTier({ derived: oldDerived, holds: input.holds, override: input.override, at: end });
    const renewAfter = billedTier({ derived: newDerived, holds: newHolds, override: input.override, at: end });
    nextRenewalDeltaCents = input.seats * (p[renewAfter] - p[renewBefore]) + catchUpCents;
  } else {
    nextRenewalDeltaCents = input.seats * (p[toTier] - p[fromTier]);
  }

  return {
    fromTier, toTier, seats: input.seats, catchUpCents, nextRenewalDeltaCents,
    holdUntil: holdUntilFor({ billed: toTier, holds: newHolds, at: input.at }),
  };
}

export function tierName(t: TierKey): string {
  return t === "CORE" ? "Core" : t === "PLUS" ? "Plus" : "Pro";
}
