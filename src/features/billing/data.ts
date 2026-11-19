/**
 * Database loaders for billing (server only). The arithmetic lives in
 * ./pricing.ts; these functions only gather its inputs.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

import { TIER_KEYS, type TierKey } from "./catalogue";
import { BillingError } from "./errors";
import type { DiscountInput, Prices, TierHoldInput, TierOverrideInput } from "./pricing";

export type BillingConfigValues = {
  vatRegistered: boolean;
  vatRateBps: number;
  apiMarginBps: number;
  trialDays: number;
  periodDays: number;
};

const CONFIG_DEFAULTS: BillingConfigValues = {
  vatRegistered: false, vatRateBps: 1500, apiMarginBps: 8000, trialDays: 14, periodDays: 30,
};

/** The BillingConfig singleton, or the design defaults before the seed has run. */
export const getBillingConfig = cache(async (): Promise<BillingConfigValues> => {
  const row = await prisma.billingConfig.findUnique({ where: { id: "singleton" } });
  if (!row) return CONFIG_DEFAULTS;
  return {
    vatRegistered: row.vatRegistered,
    vatRateBps: row.vatRateBps,
    apiMarginBps: row.apiMarginBps,
    trialDays: row.trialDays,
    periodDays: row.periodDays,
  };
});

/** Tier prices in force at `at` (the latest activeFrom per key). Throws before the seed. */
export async function getTierPrices(at: Date): Promise<{ prices: Prices; aiMarksPerStudent: number }> {
  const rows = await prisma.tier.findMany({
    where: { activeFrom: { lte: at }, OR: [{ activeTo: null }, { activeTo: { gt: at } }] },
    orderBy: { activeFrom: "desc" },
  });
  const prices = {} as Prices;
  let aiMarksPerStudent = 0;
  for (const key of TIER_KEYS) {
    const row = rows.find((r) => r.key === key);
    if (!row) throw new BillingError("NOT_FOUND", `No ${key} tier price at ${at.toISOString()}; run scripts/seed-billing.ts`);
    prices[key] = row.priceCents;
    if (key === "PRO") aiMarksPerStudent = row.aiMarksPerStudent;
  }
  return { prices, aiMarksPerStudent };
}

export type CourseBillingRow = {
  courseId: string;
  title: string;
  workspaceId: string;
  enabledKeys: string[];
  holds: TierHoldInput[];
  override: TierOverrideInput;
};

const courseSelect = {
  id: true,
  name: true,
  workspaceId: true,
  services: { where: { enabled: true }, select: { serviceKey: true } },
  tierHolds: { select: { tierKey: true, raisedAt: true, holdUntil: true } },
  tierOverride: { select: { tierKey: true, until: true } },
} as const;

type CourseSelected = {
  id: string;
  name: string;
  workspaceId: string | null;
  services: Array<{ serviceKey: string }>;
  tierHolds: Array<{ tierKey: TierKey; raisedAt: Date; holdUntil: Date }>;
  tierOverride: { tierKey: TierKey; until: Date | null } | null;
};

function toRow(c: CourseSelected): CourseBillingRow {
  return {
    courseId: c.id,
    title: c.name,
    workspaceId: c.workspaceId ?? "",
    enabledKeys: c.services.map((s) => s.serviceKey),
    holds: c.tierHolds,
    override: c.tierOverride,
  };
}

/** One course with its switched-on services, holds and override. Cached per request. */
export const loadCourseBilling = cache(async (courseId: string): Promise<CourseBillingRow | null> => {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: courseSelect });
  return c && c.workspaceId ? toRow(c) : null;
});

export async function loadWorkspaceCourses(workspaceId: string): Promise<CourseBillingRow[]> {
  const rows = await prisma.course.findMany({ where: { workspaceId }, select: courseSelect, orderBy: { name: "asc" } });
  return rows.map(toRow);
}

/** Distinct learners per course with an open enrolment now. */
export async function activeSeatsByCourse(courseIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(courseIds.map((id) => [id, []]));
  if (courseIds.length === 0) return out;
  const rows = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds }, status: "ACTIVE", endedAt: null },
    select: { courseId: true, learnerId: true },
  });
  for (const r of rows) {
    const list = out.get(r.courseId)!;
    if (!list.includes(r.learnerId)) list.push(r.learnerId);
  }
  return out;
}

/** Distinct learners per course whose enrolment interval overlaps [from, to). */
export async function overlappingLearnersByCourse(courseIds: string[], from: Date, to: Date): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(courseIds.map((id) => [id, []]));
  if (courseIds.length === 0) return out;
  const rows = await prisma.enrollment.findMany({
    where: {
      courseId: { in: courseIds },
      startedAt: { lt: to },
      OR: [{ endedAt: null }, { endedAt: { gt: from } }],
    },
    select: { courseId: true, learnerId: true },
  });
  for (const r of rows) {
    const list = out.get(r.courseId)!;
    if (!list.includes(r.learnerId)) list.push(r.learnerId);
  }
  return out;
}

export type OpenPeriod = {
  id: string;
  start: Date;
  end: Date;
  /** SeatCharge rows of the period, by course. */
  charged: Map<string, Array<{ learnerId: string; tierKey: TierKey }>>;
};

/** The workspace's period containing `at`, with its seat charges. */
export async function loadOpenPeriod(workspaceId: string, at: Date): Promise<OpenPeriod | null> {
  const p = await prisma.billingPeriod.findFirst({
    where: { workspaceId, start: { lte: at }, end: { gt: at } },
    select: { id: true, start: true, end: true, seatCharges: { select: { courseId: true, learnerId: true, tierKey: true } } },
  });
  if (!p) return null;
  const charged = new Map<string, Array<{ learnerId: string; tierKey: TierKey }>>();
  for (const s of p.seatCharges) {
    charged.set(s.courseId, [...(charged.get(s.courseId) ?? []), { learnerId: s.learnerId, tierKey: s.tierKey }]);
  }
  return { id: p.id, start: p.start, end: p.end, charged };
}

/** AI marks and their provider cost per course in [from, to). */
export async function aiUsageByCourse(workspaceId: string, from: Date, to: Date): Promise<Map<string, { marks: number; costMilliCents: number }>> {
  const rows = await prisma.usageRecord.groupBy({
    by: ["scopeKey"],
    where: { workspaceId, meter: "AI_MARKS", day: { gte: from, lt: to } },
    _sum: { quantity: true, providerCostMilliCents: true },
  });
  return new Map(rows.map((r) => [r.scopeKey, { marks: r._sum.quantity ?? 0, costMilliCents: r._sum.providerCostMilliCents ?? 0 }]));
}

/**
 * The workspace's discount (one code: a WORKSPACE_BILL code first, else a
 * scoped one) and its open credit, for the next invoice. Nothing is used up
 * here; markInvoicePaid counts the period and consumes the credit.
 */
export async function loadInvoiceAdjustments(workspaceId: string, at: Date): Promise<{ discount: DiscountInput | null; creditAvailableCents: number }> {
  const [redemptions, credit] = await Promise.all([
    prisma.redemption.findMany({
      where: { workspaceId, exhaustedAt: null, discountCode: { active: true, scope: { not: "PARENT_INVOICE" } } },
      select: { discountCode: true },
      orderBy: { redeemedAt: "asc" },
    }),
    prisma.creditNote.aggregate({ where: { workspaceId, status: "OPEN" }, _sum: { amountCents: true } }),
  ]);
  const usable = redemptions
    .map((r) => r.discountCode)
    .filter((c) => c.startsAt <= at && (!c.endsAt || c.endsAt > at));
  const code = usable.find((c) => c.scope === "WORKSPACE_BILL") ?? usable[0] ?? null;
  return {
    discount: code
      ? {
          discountCodeId: code.id, code: code.code, kind: code.kind, percentBps: code.percentBps, amountCents: code.amountCents,
          scope: code.scope as DiscountInput["scope"], scopeTierKey: code.scopeTierKey, scopeServiceKey: code.scopeServiceKey,
        }
      : null,
    creditAvailableCents: credit._sum.amountCents ?? 0,
  };
}
