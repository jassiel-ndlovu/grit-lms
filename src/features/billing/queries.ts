/**
 * Billing queries (docs/revamp/contracts/billing.md, section 1). Server
 * only, behind the BILLING flag: with BILLING unset every call throws
 * BillingError("BILLING_DISABLED"). Prices come from Tier rows; the
 * arithmetic is in ./pricing.ts.
 *
 * Built here: getBillingOverview, getCourseTiers, getCourseServices,
 * previewServiceChange, getUsage, listPlatformInvoices, getPlatformInvoice.
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
  loadInvoiceAdjustments,
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

/** Usage against each cap, counted from `windowStart` (the period or the trial). */
async function capStatuses(workspaceId: string, windowStart: Date, meter?: string): Promise<CapStatus[]> {
  const capRows = await prisma.usageCap.findMany({ where: { workspaceId, ...(meter ? { meter: meter as never } : {}) } });
  const caps: CapStatus[] = [];
  for (const cap of capRows) {
    let used: number;
    if (cap.meter === "ACTIVE_STUDENTS") {
      used = await distinctActiveLearners(workspaceId);
    } else {
      const s = await prisma.usageRecord.aggregate({
        where: { workspaceId, meter: cap.meter, day: { gte: windowStart } },
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
  return caps;
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
  const adj = await loadInvoiceAdjustments(workspace.id, renewAt);
  const draft = buildPeriodInvoice({
    prices, advance, closing, aiMarksPerStudent, apiMarginBps: config.apiMarginBps,
    discount: adj.discount,
    creditAvailableCents: adj.creditAvailableCents,
    vatRateBps: config.vatRegistered ? config.vatRateBps : null,
  });

  // Caps, counted over the current period (or the trial).
  const windowStart = period?.start
    ?? (workspace.trialEndsAt ? addDays(new Date(workspace.trialEndsAt), -config.trialDays) : addDays(now, -config.periodDays));
  const caps = await capStatuses(workspace.id, windowStart);

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

/* ------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* ------------------------------------------------------------------------- */

export type InvoiceSummary = {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";
  totalCents: number;
  issuedAt: string;
  paidAt: string | null;
};

type InvoiceRow = {
  id: string; number: string; status: string; totalCents: number; issuedAt: Date; paidAt: Date | null;
  opensPeriodStart: Date; closesPeriodId: string | null;
};

/**
 * The period an invoice pays for: the one it opened (paid), else the one it
 * closes (a final invoice after cancel), else the 30 days it would open.
 * PAST_DUE shows as OPEN, as in the contract's InvoiceStatus.
 */
async function summarise(rows: InvoiceRow[], periodDays: number): Promise<InvoiceSummary[]> {
  const ids = rows.map((r) => r.id);
  const closing = rows.map((r) => r.closesPeriodId).filter((x): x is string => x != null);
  const periods = await prisma.billingPeriod.findMany({
    where: { OR: [{ openedByInvoiceId: { in: ids } }, { id: { in: closing } }] },
    select: { id: true, start: true, end: true, openedByInvoiceId: true },
  });
  return rows.map((r) => {
    const opened = periods.find((p) => p.openedByInvoiceId === r.id);
    const hasAdvance = opened != null;
    const closed = !hasAdvance && r.closesPeriodId ? periods.find((p) => p.id === r.closesPeriodId) : undefined;
    const start = opened?.start ?? closed?.start ?? r.opensPeriodStart;
    const end = opened?.end ?? closed?.end ?? addDays(r.opensPeriodStart, periodDays);
    return {
      id: r.id,
      number: r.number,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      status: (r.status === "PAST_DUE" ? "OPEN" : r.status) as InvoiceSummary["status"],
      totalCents: r.totalCents,
      issuedAt: r.issuedAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
    };
  });
}

const invoiceRowSelect = {
  id: true, number: true, status: true, totalCents: true, issuedAt: true, paidAt: true, opensPeriodStart: true, closesPeriodId: true,
} as const;

/** The workspace's invoices, newest first. Drafts are left out. `cursor` is the last id of the previous page. */
export async function listPlatformInvoices(input: { cursor?: string; limit?: number } = {}) {
  const { workspace } = await workspaceViewer("billing.view");
  return listPlatformInvoicesFor(workspace.id, input);
}

/** listPlatformInvoices without the permission check (scripts, admin console). */
export async function listPlatformInvoicesFor(workspaceId: string, input: { cursor?: string; limit?: number } = {}) {
  const workspace = { id: workspaceId };
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const config = await getBillingConfig();
  const rows = await prisma.platformInvoice.findMany({
    where: { workspaceId: workspace.id, status: { not: "DRAFT" } },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: invoiceRowSelect,
  });
  const page = rows.slice(0, limit);
  return {
    items: await summarise(page, config.periodDays),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

/**
 * One invoice with its lines and payments. `pdfUrl` is the PDF route
 * (/api/billing/invoices/[id]/pdf), rendered on request.
 */
export async function getPlatformInvoice(input: { id: string }) {
  const { workspace } = await workspaceViewer("billing.view");
  return getPlatformInvoiceFor(workspace.id, input);
}

/** getPlatformInvoice without the permission check (scripts, admin console). */
export async function getPlatformInvoiceFor(workspaceId: string, input: { id: string }) {
  const workspace = { id: workspaceId };
  const inv = await prisma.platformInvoice.findFirst({
    where: { id: input.id, workspaceId: workspace.id, status: { not: "DRAFT" } },
    select: {
      ...invoiceRowSelect,
      subtotalCents: true, discountCents: true, creditCents: true, vatCents: true,
      lines: { orderBy: { id: "asc" }, select: { kind: true, courseId: true, courseTitle: true, tierKey: true, serviceKey: true, description: true, quantity: true, unitPriceCents: true, amountCents: true } },
      payments: { where: { status: { in: ["SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, paidAt: true, amountCents: true, status: true } },
      offsitePayments: { where: { voidedAt: null }, select: { receivedOn: true, amountCents: true } },
    },
  });
  if (!inv) throw new BillingError("NOT_FOUND", "Invoice not found");
  const config = await getBillingConfig();
  const [summary] = await summarise([inv], config.periodDays);
  const payments = [
    ...inv.payments.map((p) => ({
      at: (p.paidAt ?? p.createdAt).toISOString(),
      amountCents: p.amountCents,
      via: "CARD" as const,
      status: p.status as "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED",
    })),
    ...inv.offsitePayments.map((o) => ({ at: o.receivedOn.toISOString(), amountCents: o.amountCents, via: "OFFSITE" as const, status: "SUCCEEDED" as const })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return {
    ...summary,
    lines: inv.lines.map((l) => toEstimateLine(l as InvoiceLineDraft)),
    subtotalCents: inv.subtotalCents,
    discountCents: inv.discountCents,
    creditCents: inv.creditCents,
    vatCents: inv.vatCents,
    payments,
    pdfUrl: `/api/billing/invoices/${inv.id}/pdf` as string | null,
  };
}

/* ------------------------------------------------------------------------- */
/* getUsage                                                                   */
/* ------------------------------------------------------------------------- */

const METER_IN: Record<ContractMeter, "ACTIVE_STUDENTS" | "AI_MARKS" | "STORAGE_MB" | "API_REQUESTS" | "LIVE_ROOM_MINUTES"> = {
  "active-students": "ACTIVE_STUDENTS",
  "ai-marks": "AI_MARKS",
  "storage-gb": "STORAGE_MB",
  "api-pass-through": "API_REQUESTS",
  "live-room-minutes": "LIVE_ROOM_MINUTES",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Usage of one meter over a billing period (default: the current one, or
 * the trial). `days` runs from the period start to today or the period end.
 *   - active-students: distinct learners with an open enrolment that day,
 *     counted from the enrolment intervals; the total is distinct learners
 *     in the period. `estimatedCents` is the period's seat charges so far:
 *     seats paid in advance plus catch-ups and tier upgrades to date.
 *   - ai-marks: marks per day from the usage meter; `estimatedCents` is the
 *     pass-through above the Pro pools so far.
 *   - storage-gb, api-pass-through, live-room-minutes: from the usage meter
 *     (empty until those features record usage); not billed in v1, so 0.
 */
export async function getUsage(input: { meter: ContractMeter; periodStart?: string }) {
  const { workspace } = await workspaceViewer("billing.view");
  return getUsageFor({ id: workspace.id, trialEndsAt: workspace.trialEndsAt ?? null }, input);
}

/** getUsage without the permission check (scripts, admin console). */
export async function getUsageFor(
  workspace: { id: string; trialEndsAt: string | Date | null },
  input: { meter: ContractMeter; periodStart?: string },
) {
  const meter = METER_IN[input.meter];
  if (!meter) throw new BillingError("NOT_FOUND", "Unknown meter");
  const now = new Date();
  const config = await getBillingConfig();

  // The period.
  let period: { id: string | null; start: Date; end: Date };
  if (input.periodStart) {
    const p = await prisma.billingPeriod.findFirst({ where: { workspaceId: workspace.id, start: new Date(input.periodStart) }, select: { id: true, start: true, end: true } });
    if (!p) throw new BillingError("NOT_FOUND", "No billing period starts then");
    period = p;
  } else {
    const open = await loadOpenPeriod(workspace.id, now);
    if (open) period = { id: open.id, start: open.start, end: open.end };
    else {
      const trialEnd = workspace.trialEndsAt ? new Date(workspace.trialEndsAt) : addDays(now, config.periodDays);
      period = { id: null, start: addDays(trialEnd, -(workspace.trialEndsAt ? config.trialDays : config.periodDays)), end: trialEnd };
    }
  }
  const until = new Date(Math.min(now.getTime(), period.end.getTime()));
  const dayList: string[] = [];
  for (let t = Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), period.start.getUTCDate()); t < until.getTime(); t += DAY_MS) {
    dayList.push(dayKey(new Date(t)));
  }

  let days: Array<{ day: string; quantity: number }>;
  let totalQuantity: number;
  if (meter === "ACTIVE_STUDENTS") {
    const rows = await prisma.enrollment.findMany({
      where: { workspaceId: workspace.id, startedAt: { lt: until }, OR: [{ endedAt: null }, { endedAt: { gt: period.start } }] },
      select: { learnerId: true, startedAt: true, endedAt: true },
    });
    days = dayList.map((day) => {
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const on = new Set(rows.filter((r) => r.startedAt < dayEnd && (!r.endedAt || r.endedAt > dayStart)).map((r) => r.learnerId));
      return { day, quantity: on.size };
    });
    totalQuantity = new Set(rows.map((r) => r.learnerId)).size;
  } else {
    const grouped = await prisma.usageRecord.groupBy({
      by: ["day"],
      where: { workspaceId: workspace.id, meter, day: { gte: period.start, lt: period.end } },
      _sum: { quantity: true },
    });
    const byDay = new Map(grouped.map((g) => [dayKey(g.day), g._sum.quantity ?? 0]));
    const toGb = (n: number) => (meter === "STORAGE_MB" ? Math.ceil(n / 1024) : n);
    days = dayList.map((day) => ({ day, quantity: toGb(byDay.get(day) ?? 0) }));
    totalQuantity = meter === "STORAGE_MB" ? Math.max(0, ...days.map((d) => d.quantity)) : days.reduce((n, d) => n + d.quantity, 0);
  }

  // Estimate, from the same invoice builder as the renewal.
  let estimatedCents = 0;
  if (meter === "ACTIVE_STUDENTS" || meter === "AI_MARKS") {
    const courses = await loadWorkspaceCourses(workspace.id);
    const courseIds = courses.map((c) => c.courseId);
    const { prices, aiMarksPerStudent } = await getTierPrices(now);
    const open = period.id ? await loadOpenPeriod(workspace.id, new Date(period.end.getTime() - 1)) : null;
    if (open) {
      const [overlap, ai] = await Promise.all([
        overlappingLearnersByCourse(courseIds, open.start, until),
        aiUsageByCourse(workspace.id, open.start, open.end),
      ]);
      const draft = buildPeriodInvoice({
        prices, aiMarksPerStudent, apiMarginBps: config.apiMarginBps, advance: [],
        closing: courses.map((c) => ({
          courseId: c.courseId,
          title: c.title,
          highestTier: highestTierDuring({ tierAtStart: courseTierAtStart(c, open), holds: c.holds, override: c.override, start: open.start, end: open.end }),
          overlappingLearnerIds: overlap.get(c.courseId) ?? [],
          charged: open.charged.get(c.courseId) ?? [],
          aiMarks: ai.get(c.courseId),
        })),
      });
      if (meter === "AI_MARKS") {
        estimatedCents = draft.lines.filter((l) => l.kind === "PASS_THROUGH" && l.serviceKey === "ai-marking").reduce((n, l) => n + l.amountCents, 0);
      } else {
        const opener = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: open.id }, select: { openedByInvoiceId: true } });
        const advance = await prisma.platformInvoiceLine.aggregate({
          where: { kind: "ADVANCE", invoiceId: opener.openedByInvoiceId },
          _sum: { amountCents: true },
        });
        estimatedCents = (advance._sum.amountCents ?? 0)
          + draft.lines.filter((l) => l.kind === "CATCH_UP" || l.kind === "TIER_UPGRADE").reduce((n, l) => n + l.amountCents, 0);
      }
    } else if (meter === "ACTIVE_STUDENTS") {
      // Trial: what the first 30 days would cost now.
      const seats = await activeSeatsByCourse(courseIds);
      const draft = buildPeriodInvoice({
        prices, aiMarksPerStudent, apiMarginBps: config.apiMarginBps,
        advance: courses.map((c) => ({
          courseId: c.courseId, title: c.title,
          tier: billedTier({ derived: derivedTier(c.enabledKeys), holds: c.holds, override: c.override, at: now }),
          learnerIds: seats.get(c.courseId) ?? [],
        })),
      });
      estimatedCents = draft.subtotalCents;
    }
  }

  const [cap] = await capStatuses(workspace.id, period.start, meter);
  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString(), renewsAt: period.end.toISOString() },
    days,
    totalQuantity,
    cap: cap ?? null,
    estimatedCents,
  };
}
