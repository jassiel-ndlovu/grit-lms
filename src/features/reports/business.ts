/**
 * The business dashboard (#216 phase 1; Plus and Pro, owner decision 22
 * Nov). One query for B's dashboard: money (invoiced, collected,
 * refunded, overdue, collection rate), students (active, joined, left), a
 * six-month trend, a per-tutor table for organisations, and AI credits
 * used. Server only. Contract: billing.md, "Business dashboard".
 *
 * Scope: the whole workspace, or a branch role's branches. For a branch,
 * money is counted from invoice lines on its courses (before invoice-level
 * discounts), because one invoice can cover several branches.
 */

import "server-only";

import { SERVICES } from "@/features/billing/catalogue";
import { isBillingEnabled } from "@/features/billing/errors";
import { prisma } from "@/lib/db";
import { scopedCourseWhere } from "@/lib/viewer-core";

const DAY = 24 * 60 * 60 * 1000;
const PAID = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]);

/** Plus and Pro only: true when any course in the workspace has a Plus or Pro service on (always with billing off, or comped). */
export async function businessDashboardAvailable(workspaceId: string): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { billingState: true } });
  if (ws.billingState === "COMPED") return true;
  const keys = Object.values(SERVICES).filter((s) => s.kind === "premium" && (s.tier === "PLUS" || s.tier === "PRO") && s.status === "v1").map((s) => s.key);
  return (await prisma.courseService.count({ where: { workspaceId, enabled: true, serviceKey: { in: keys } } })) > 0;
}

export type DashboardScope = { membershipId: string; branchIds: string[] } | null;

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function businessDashboardFor(workspaceId: string, scope: DashboardScope, input: { from?: Date; to?: Date } = {}, now: Date = new Date()) {
  const to = input.to ?? now;
  const from = input.from ?? new Date(to.getTime() - 30 * DAY);
  const trendFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const earliest = new Date(Math.min(from.getTime(), trendFrom.getTime()));

  const courses = await prisma.course.findMany({
    where: { workspaceId, ...(scope ? scopedCourseWhere(scope) : {}) },
    select: {
      id: true, name: true, ownerMembershipId: true,
      staff: { where: { role: "LEAD" }, select: { membershipId: true, membership: { select: { user: { select: { name: true } } } } } },
    },
  });
  const courseIds = courses.map((c) => c.id);
  const inScope = new Set(courseIds);

  // Invoices that matter for any number below.
  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId, status: { notIn: ["DRAFT"] },
      OR: [{ issuedAt: { gte: earliest } }, { paidAt: { gte: earliest } }, { dueAt: { gte: earliest } }, { status: "OPEN" }],
      ...(scope ? { lines: { some: { courseId: { in: courseIds } } } } : {}),
    },
    select: { id: true, status: true, issuedAt: true, dueAt: true, paidAt: true, paidVia: true, totalCents: true, lines: { select: { courseId: true, amountCents: true } } },
  });
  /** The part of an invoice this scope counts. */
  const amountOf = (inv: (typeof invoices)[number]) => (scope ? inv.lines.filter((l) => l.courseId && inScope.has(l.courseId)).reduce((n, l) => n + l.amountCents, 0) : inv.totalCents);
  const within = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d < b;
  const live = invoices.filter((i) => i.status !== "VOID");

  const invoiced = live.filter((i) => within(i.issuedAt, from, to)).reduce((n, i) => n + amountOf(i), 0);
  const paidInPeriod = live.filter((i) => PAID.has(i.status) && within(i.paidAt, from, to));
  const collected = paidInPeriod.reduce((n, i) => n + amountOf(i), 0);
  const collectedOffsite = paidInPeriod.filter((i) => i.paidVia === "OFFSITE").reduce((n, i) => n + amountOf(i), 0);
  const dueInPeriod = live.filter((i) => within(i.dueAt, from, to));
  const dueTotal = dueInPeriod.reduce((n, i) => n + amountOf(i), 0);
  const duePaid = dueInPeriod.filter((i) => PAID.has(i.status)).reduce((n, i) => n + amountOf(i), 0);
  const overdueRows = live.filter((i) => i.status === "OPEN" && i.dueAt < now);
  const dueSoon = live.filter((i) => i.status === "OPEN" && i.dueAt >= now && i.dueAt < new Date(now.getTime() + 7 * DAY));

  const refunds = scope
    ? 0
    : (await prisma.refund.aggregate({ where: { status: "PROCESSED", processedAt: { gte: from, lt: to }, payment: { workspaceId } }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;

  // Students, through enrolments on the courses in scope.
  const enrolments = await prisma.enrollment.findMany({ where: { workspaceId, courseId: { in: courseIds } }, select: { learnerId: true, courseId: true, startedAt: true, endedAt: true } });
  const byLearner = new Map<string, Array<(typeof enrolments)[number]>>();
  for (const e of enrolments) byLearner.set(e.learnerId, [...(byLearner.get(e.learnerId) ?? []), e]);
  let active = 0, joined = 0, left = 0;
  const joinedByMonth = new Map<string, number>();
  for (const rows of byLearner.values()) {
    const first = rows.reduce((a, b) => (a.startedAt < b.startedAt ? a : b)).startedAt;
    const open = rows.some((r) => !r.endedAt);
    if (open) active++;
    if (within(first, from, to)) joined++;
    if (first >= trendFrom) joinedByMonth.set(monthKey(first), (joinedByMonth.get(monthKey(first)) ?? 0) + 1);
    const lastEnd = rows.filter((r) => r.endedAt).reduce<Date | null>((d, r) => (!d || r.endedAt! > d ? r.endedAt! : d), null);
    if (!open && within(lastEnd, from, to)) left++;
  }

  // Six-month trend.
  const months: string[] = [];
  for (let k = 5; k >= 0; k--) months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1))));
  const collectedByMonth = new Map<string, number>();
  for (const i of live) if (PAID.has(i.status) && i.paidAt && i.paidAt >= trendFrom) collectedByMonth.set(monthKey(i.paidAt), (collectedByMonth.get(monthKey(i.paidAt)) ?? 0) + amountOf(i));
  const trend = months.map((m) => ({ month: m, collectedCents: collectedByMonth.get(m) ?? 0, newStudents: joinedByMonth.get(m) ?? 0 }));

  // Per tutor: a course counts for its lead tutors, else its owner.
  const tutorOf = new Map<string, Array<{ id: string; name: string }>>();
  const owners = new Map((await prisma.membership.findMany({ where: { id: { in: courses.map((c) => c.ownerMembershipId).filter((x): x is string => !!x) } }, select: { id: true, user: { select: { name: true } } } })).map((m) => [m.id, m.user.name]));
  for (const c of courses) {
    const leads = c.staff.map((s) => ({ id: s.membershipId, name: s.membership.user.name }));
    tutorOf.set(c.id, leads.length ? leads : c.ownerMembershipId ? [{ id: c.ownerMembershipId, name: owners.get(c.ownerMembershipId) ?? "Former member" }] : []);
  }
  const perTutor = new Map<string, { membershipId: string; name: string; courses: number; activeStudents: Set<string>; invoicedCents: number; collectedCents: number; overdueCents: number }>();
  const row = (t: { id: string; name: string }) => {
    const r = perTutor.get(t.id) ?? { membershipId: t.id, name: t.name, courses: 0, activeStudents: new Set<string>(), invoicedCents: 0, collectedCents: 0, overdueCents: 0 };
    perTutor.set(t.id, r);
    return r;
  };
  for (const c of courses) for (const t of tutorOf.get(c.id) ?? []) row(t).courses++;
  for (const e of enrolments) if (!e.endedAt) for (const t of tutorOf.get(e.courseId) ?? []) row(t).activeStudents.add(e.learnerId);
  for (const i of live) {
    for (const l of i.lines) {
      if (!l.courseId || !inScope.has(l.courseId)) continue;
      const tutors = tutorOf.get(l.courseId) ?? [];
      if (!tutors.length) continue;
      const share = Math.round(l.amountCents / tutors.length);
      for (const t of tutors) {
        const r = row(t);
        if (within(i.issuedAt, from, to)) r.invoicedCents += share;
        if (PAID.has(i.status) && within(i.paidAt, from, to)) r.collectedCents += share;
        if (i.status === "OPEN" && i.dueAt < now) r.overdueCents += share;
      }
    }
  }

  const aiCredits = scope
    ? null
    : -((await prisma.aiCreditEntry.aggregate({ where: { workspaceId, kind: "SPEND", createdAt: { gte: from, lt: to } }, _sum: { credits: true } }))._sum.credits ?? 0);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    scope: scope ? { branchIds: scope.branchIds } : null,
    currency: "ZAR" as const,
    money: {
      invoicedCents: invoiced,
      collectedCents: collected,
      collectedOffsiteCents: collectedOffsite,
      refundedCents: refunds,
      /** Of what fell due in the period, the share paid so far, in basis points; null when nothing fell due. */
      collectionRateBps: dueTotal > 0 ? Math.round((duePaid / dueTotal) * 10_000) : null,
      overdue: { invoices: overdueRows.length, cents: overdueRows.reduce((n, i) => n + amountOf(i), 0), oldestDueAt: overdueRows.reduce<Date | null>((d, i) => (!d || i.dueAt < d ? i.dueAt : d), null)?.toISOString() ?? null },
      dueNext7Days: { invoices: dueSoon.length, cents: dueSoon.reduce((n, i) => n + amountOf(i), 0) },
    },
    students: { active, joined, left, courses: courses.length },
    trend,
    tutors: [...perTutor.values()]
      .map((t) => ({ membershipId: t.membershipId, name: t.name, courses: t.courses, activeStudents: t.activeStudents.size, invoicedCents: t.invoicedCents, collectedCents: t.collectedCents, overdueCents: t.overdueCents }))
      .sort((a, b) => b.collectedCents - a.collectedCents || b.activeStudents - a.activeStudents),
    aiCreditsUsed: aiCredits,
    notes: scope ? ["Branch figures come from invoice lines on the branch's courses, before invoice-level discounts. Refunds and AI credits show on the whole-organisation view."] : [],
    generatedAt: now.toISOString(),
  };
}
