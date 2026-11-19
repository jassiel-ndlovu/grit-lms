/**
 * Billing queries (docs/revamp/contracts/billing.md, section 1). Server
 * only, behind the BILLING flag: with BILLING unset every call throws
 * BillingError("BILLING_DISABLED"). Prices come from Tier rows; the
 * arithmetic is in ./pricing.ts.
 *
 * Built here: getBillingOverview, getCourseTiers, getCourseServices,
 * previewServiceChange. getUsage, listPlatformInvoices and
 * getPlatformInvoice follow with invoicing.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { canIn, requireViewer, ViewerError, type BillingState, type Viewer } from "@/lib/viewer";

import { SERVICES, TIER_RANK, type ServiceKey, type TierKey } from "./catalogue";
import {
  activeSeatsByCourse,
  aiUsageByCourse,
  getBillingConfig,
  getTierPrices,
  loadCourseBilling,
  loadOpenPeriod,
  loadWorkspaceCourses,
  overlappingLearnersByCourse,
  type CourseBillingRow,
  type OpenPeriod,
} from "./data";
import { assertBillingEnabled, BillingError } from "./errors";
import {
  addDays,
  billedTier,
  buildPeriodInvoice,
  daysLeft,
  derivedTier,
  highestTierDuring,
  holdUntilFor,
  maxTier,
  previewServiceChange as previewPure,
  type InvoiceLineDraft,
} from "./pricing";

/* ------------------------------------------------------------------------- */
/* Contract types                                                             */
/* ------------------------------------------------------------------------- */

export type ContractMeter = "active-students" | "ai-marks" | "storage-gb" | "api-pass-through" | "live-room-minutes";
export type Period = { start: string; end: string; renewsAt: string };
export type EstimateLine = {
  kind: "SEATS" | "CATCH_UP" | "USAGE" | "PASS_THROUGH" | "DISCOUNT" | "CREDIT" | "VAT";
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};
export type CapStatus = {
  meter: ContractMeter;
  used: number;
  limit: number | null;
  percent: number | null;
  hardStop: boolean;
  source: "TRIAL" | "TUTOR" | "ADMIN";
};

/* ------------------------------------------------------------------------- */
/* Access                                                                     */
/* ------------------------------------------------------------------------- */

async function workspaceViewer(permission: "billing.view" | "billing.manage") {
  assertBillingEnabled();
  const viewer = await requireViewer({ permission, workspace: true });
  return { viewer, workspace: viewer.workspace! };
}

/** Viewer may switch services on this course, and the course is in their workspace. */
export async function requireCourseServicesAccess(courseId: string): Promise<{ viewer: Viewer; course: CourseBillingRow }> {
  assertBillingEnabled();
  const viewer = await requireViewer({ workspace: true });
  if (!(await canIn(viewer, "courses.services", { courseId }))) throw new ViewerError("FORBIDDEN");
  const course = await loadCourseBilling(courseId);
  if (!course || course.workspaceId !== viewer.workspace!.id) throw new BillingError("NOT_FOUND", "Course not found");
  return { viewer, course };
}

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* ------------------------------------------------------------------------- */

export function courseTierAtStart(c: CourseBillingRow, period: OpenPeriod): TierKey {
  const charged = period.charged.get(c.courseId) ?? [];
  if (charged.length > 0) return maxTier(...charged.map((s) => s.tierKey));
  return billedTier({ derived: derivedTier(c.enabledKeys), holds: c.holds, override: c.override, at: period.start });
}

function toEstimateLine(l: InvoiceLineDraft): EstimateLine {
  const kind: EstimateLine["kind"] =
    l.kind === "ADVANCE" ? "SEATS"
    : l.kind === "CATCH_UP" || l.kind === "TIER_UPGRADE" ? "CATCH_UP"
    : l.kind === "ADDON" ? "USAGE"
    : l.kind === "PASS_THROUGH" ? "PASS_THROUGH"
    : l.kind === "DISCOUNT" ? "DISCOUNT"
    : l.kind === "VAT" ? "VAT"
    : "CREDIT";
  return { kind, description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents, amountCents: l.amountCents };
}

const METER_OUT: Record<string, ContractMeter> = {
  ACTIVE_STUDENTS: "active-students",
  AI_MARKS: "ai-marks",
  STORAGE_MB: "storage-gb",
  API_REQUESTS: "api-pass-through",
  LIVE_ROOM_MINUTES: "live-room-minutes",
};

/** Learners with an open enrolment anywhere in the workspace (trial cap). */
async function distinctActiveLearners(workspaceId: string): Promise<number> {
  const rows = await prisma.enrollment.findMany({
    where: { workspaceId, status: "ACTIVE", endedAt: null },
    select: { learnerId: true },
    distinct: ["learnerId"],
  });
  return rows.length;
}

/* ------------------------------------------------------------------------- */
/* getBillingOverview                                                         */
/* ------------------------------------------------------------------------- */

export async function getBillingOverview() {
  const { workspace } = await workspaceViewer("billing.view");
  const now = new Date();
  const config = await getBillingConfig();
  const [sub, courses, period, { prices, aiMarksPerStudent }] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId: workspace.id } }),
    loadWorkspaceCourses(workspace.id),
    loadOpenPeriod(workspace.id, now),
    getTierPrices(now),
  ]);
  const courseIds = courses.map((c) => c.courseId);
  const renewAt = sub?.renewsAt ?? now;

  // Estimate of the next renewal: seats now at the tier billed on the renewal
  // date, plus this period's arrears so far.
  const seats = await activeSeatsByCourse(courseIds);
  const advance = courses.map((c) => ({
    courseId: c.courseId,
    title: c.title,
    tier: billedTier({ derived: derivedTier(c.enabledKeys), holds: c.holds, override: c.override, at: renewAt }),
    learnerIds: seats.get(c.courseId) ?? [],
  }));
  let closing: Parameters<typeof buildPeriodInvoice>[0]["closing"] = undefined;
  if (period) {
    const [overlap, ai] = await Promise.all([
      overlappingLearnersByCourse(courseIds, period.start, now),
      aiUsageByCourse(workspace.id, period.start, period.end),
    ]);
    closing = courses.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      highestTier: highestTierDuring({ tierAtStart: courseTierAtStart(c, period), holds: c.holds, override: c.override, start: period.start, end: period.end }),
      overlappingLearnerIds: overlap.get(c.courseId) ?? [],
      charged: period.charged.get(c.courseId) ?? [],
      aiMarks: ai.get(c.courseId),
    }));
  }
  const credit = await prisma.creditNote.aggregate({ where: { workspaceId: workspace.id, status: "OPEN" }, _sum: { amountCents: true } });
  const draft = buildPeriodInvoice({
    prices, advance, closing, aiMarksPerStudent, apiMarginBps: config.apiMarginBps,
    creditAvailableCents: credit._sum.amountCents ?? 0,
    vatRateBps: config.vatRegistered ? config.vatRateBps : null,
  });

  // Caps, counted over the current period (or the trial).
  const windowStart = period?.start
    ?? (workspace.trialEndsAt ? addDays(new Date(workspace.trialEndsAt), -config.trialDays) : addDays(now, -config.periodDays));
  const capRows = await prisma.usageCap.findMany({ where: { workspaceId: workspace.id } });
  const caps: CapStatus[] = [];
  for (const cap of capRows) {
    let used: number;
    if (cap.meter === "ACTIVE_STUDENTS") {
      used = await distinctActiveLearners(workspace.id);
    } else {
      const s = await prisma.usageRecord.aggregate({
        where: { workspaceId: workspace.id, meter: cap.meter, day: { gte: windowStart } },
        _sum: { quantity: true },
      });
      used = s._sum.quantity ?? 0;
    }
    let limit = cap.limitQuantity;
    if (cap.meter === "STORAGE_MB") {
      used = Math.ceil(used / 1024);
      limit = Math.ceil(limit / 1024);
    }
    caps.push({
      meter: METER_OUT[cap.meter],
      used,
      limit,
      percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null,
      hardStop: cap.hardStop,
      source: cap.source,
    });
  }

  const overdue = await prisma.platformInvoice.findFirst({
    where: { workspaceId: workspace.id, OR: [{ status: "PAST_DUE" }, { status: "OPEN", dueAt: { lt: now } }] },
    orderBy: { issuedAt: "desc" },
    select: { id: true },
  });

  const trialEndsAt = workspace.trialEndsAt;
  return {
    state: workspace.billingState as BillingState,
    trialEndsAt,
    trialDaysLeft: workspace.billingState === "TRIAL" && trialEndsAt ? daysLeft(new Date(trialEndsAt), now) : null,
    card: sub?.cardLast4
      ? { brand: sub.cardBrand ?? "", last4: sub.cardLast4, expMonth: sub.cardExpMonth ?? 0, expYear: sub.cardExpYear ?? 0 }
      : null,
    period: sub?.currentPeriodStart && sub.currentPeriodEnd
      ? {
          start: sub.currentPeriodStart.toISOString(),
          end: sub.currentPeriodEnd.toISOString(),
          renewsAt: (sub.renewsAt ?? sub.currentPeriodEnd).toISOString(),
        }
      : null,
    nextRenewalEstimateCents: draft.totalCents,
    estimate: draft.lines.map(toEstimateLine),
    caps,
    overdueInvoiceId: overdue?.id ?? null,
    deleteAfter: sub?.deleteAfter?.toISOString() ?? null,
    vatRegistered: config.vatRegistered,
  };
}

/* ------------------------------------------------------------------------- */
/* getCourseTiers                                                             */
/* ------------------------------------------------------------------------- */

export async function getCourseTiers() {
  const { workspace } = await workspaceViewer("billing.view");
  const now = new Date();
  const [courses, period, { prices, aiMarksPerStudent }] = await Promise.all([
    loadWorkspaceCourses(workspace.id),
    loadOpenPeriod(workspace.id, now),
    getTierPrices(now),
  ]);
  const ids = courses.map((c) => c.courseId);
  const [seats, overlap, ai] = await Promise.all([
    activeSeatsByCourse(ids),
    period ? overlappingLearnersByCourse(ids, period.start, now) : Promise.resolve(null),
    period ? aiUsageByCourse(workspace.id, period.start, period.end) : Promise.resolve(null),
  ]);

  return courses.map((c) => {
    const derived = derivedTier(c.enabledKeys);
    const billed = billedTier({ derived, holds: c.holds, override: c.override, at: now });
    const charged = period?.charged.get(c.courseId) ?? [];
    const chargedIds = new Set(charged.map((s) => s.learnerId));
    const seatsThisPeriod = period ? charged.length : (seats.get(c.courseId)?.length ?? 0);
    const pendingCatchUpSeats = period ? (overlap?.get(c.courseId) ?? []).filter((id) => !chargedIds.has(id)).length : 0;
    const overrideLive = c.override && (!c.override.until || c.override.until > now) ? c.override : null;
    const drivers = c.enabledKeys.filter((k): k is ServiceKey =>
      k in SERVICES && SERVICES[k as ServiceKey].kind === "premium" && SERVICES[k as ServiceKey].status === "v1" &&
      SERVICES[k as ServiceKey].tier === derived);
    return {
      courseId: c.courseId,
      title: c.title,
      derivedTierKey: derived,
      billedTierKey: billed,
      holdUntil: holdUntilFor({ billed, holds: c.holds, at: now })?.toISOString() ?? null,
      drivers,
      seatsThisPeriod,
      pendingCatchUpSeats,
      unitPriceCents: prices[billed],
      aiPool: billed === "PRO"
        ? { included: aiMarksPerStudent * (seatsThisPeriod + pendingCatchUpSeats), used: ai?.get(c.courseId)?.marks ?? 0 }
        : null,
      override: overrideLive ? { tierKey: overrideLive.tierKey, until: overrideLive.until?.toISOString() ?? null } : null,
    };
  });
}

/* ------------------------------------------------------------------------- */
/* getCourseServices                                                          */
/* ------------------------------------------------------------------------- */

export type CourseServiceItem = {
  key: ServiceKey;
  name: string;
  kind: "basic" | "premium";
  tierKey: TierKey;
  status: "v1" | "later" | "parked";
  enabled: boolean;
  availableNow: boolean;
  reason?: "PARKED" | "LATER" | "PAST_DUE" | "READ_ONLY";
};

export async function getCourseServices(input: { courseId: string }): Promise<CourseServiceItem[]> {
  const { viewer, course } = await requireCourseServicesAccess(input.courseId);
  const state = viewer.workspace!.billingState;
  const now = new Date();
  const enabled = new Set(course.enabledKeys);
  const billed = billedTier({ derived: derivedTier(enabled), holds: course.holds, override: course.override, at: now });

  return Object.values(SERVICES).map((s) => {
    if (s.kind === "basic") {
      return { key: s.key, name: s.name, kind: s.kind, tierKey: s.tier, status: s.status, enabled: true, availableNow: true };
    }
    const on = enabled.has(s.key) && s.status === "v1";
    let reason: CourseServiceItem["reason"];
    if (s.status === "parked") reason = "PARKED";
    else if (s.status === "later") reason = "LATER";
    else if (state === "READ_ONLY" || state === "CANCELLED" || viewer.workspace!.readOnly) reason = "READ_ONLY";
    else if (state === "PAST_DUE" && !on && TIER_RANK[s.tier] > TIER_RANK[billed]) reason = "PAST_DUE";
    return {
      key: s.key, name: s.name, kind: s.kind, tierKey: s.tier, status: s.status,
      enabled: on,
      availableNow: reason === undefined,
      ...(reason ? { reason } : {}),
    };
  });
}

/* ------------------------------------------------------------------------- */
/* previewServiceChange                                                       */
/* ------------------------------------------------------------------------- */

/** Rejects keys that cannot be switched: unknown, basic, parked or later. */
export function assertSwitchable(keys: readonly string[]): void {
  for (const k of keys) {
    const s = (SERVICES as Record<string, (typeof SERVICES)[ServiceKey] | undefined>)[k];
    if (!s) throw new BillingError("FORBIDDEN", `Unknown service ${k}`);
    if (s.kind !== "premium") throw new BillingError("FORBIDDEN", `${k} is a basic service and always on`);
    if (s.status !== "v1") throw new BillingError("FORBIDDEN", `${k} is ${s.status}`);
  }
}

/** Inputs for the pure preview, shared with setCourseServices. */
export async function loadServiceChangeContext(course: CourseBillingRow, state: BillingState, now: Date) {
  const [{ prices }, config, sub, period, seats] = await Promise.all([
    getTierPrices(now),
    getBillingConfig(),
    prisma.subscription.findUnique({ where: { workspaceId: course.workspaceId }, select: { renewsAt: true } }),
    loadOpenPeriod(course.workspaceId, now),
    activeSeatsByCourse([course.courseId]),
  ]);
  let periodInput: Parameters<typeof previewPure>[0]["period"] = null;
  if (period) {
    const overlap = await overlappingLearnersByCourse([course.courseId], period.start, now);
    const charged = period.charged.get(course.courseId) ?? [];
    const chargedIds = new Set(charged.map((s) => s.learnerId));
    periodInput = {
      start: period.start,
      renewsAt: sub?.renewsAt ?? period.end,
      tierAtStart: courseTierAtStart(course, period),
      charged: charged.map((s) => s.tierKey),
      pendingCatchUpSeats: (overlap.get(course.courseId) ?? []).filter((id) => !chargedIds.has(id)).length,
    };
  }
  return {
    prices,
    holdDays: config.periodDays,
    inTrial: state === "TRIAL",
    seats: seats.get(course.courseId)?.length ?? 0,
    period: periodInput,
  };
}

export async function previewServiceChange(input: { courseId: string; enable: string[]; disable: string[] }) {
  const { viewer, course } = await requireCourseServicesAccess(input.courseId);
  assertSwitchable([...input.enable, ...input.disable]);
  const now = new Date();
  const ctx = await loadServiceChangeContext(course, viewer.workspace!.billingState, now);
  const r = previewPure({
    ...ctx,
    at: now,
    enabled: course.enabledKeys,
    enable: input.enable,
    disable: input.disable,
    holds: course.holds,
    override: course.override,
  });
  return {
    fromTier: r.fromTier,
    toTier: r.toTier,
    seats: r.seats,
    catchUpCents: r.catchUpCents,
    nextRenewalDeltaCents: r.nextRenewalDeltaCents,
    holdUntil: r.holdUntil?.toISOString() ?? null,
  };
}
