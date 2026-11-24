/**
 * Per-tutor outcomes and staff reviews (#216 phase 3, organisations).
 * Contract: viewer.md, "Tutor outcomes and reviews".
 *
 * Outcomes: for each tutor, over a period, from their courses (they teach
 * or own): students, marks and their change, hand-in rate, attendance,
 * at-risk alerts, approved timesheet hours and booked lessons.
 * Managers with `staff.reviews` (or `reports.view`) see the staff in their
 * scope; every tutor sees their own.
 *
 * Reviews: a manager writes one for a tutor and period (the outcomes are
 * saved with it), shares it, and the tutor acknowledges with a reply.
 */

import "server-only";

import { emitNotification } from "@/features/notifications/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { computeOutcomes, monthsBetween, type TutorOutcomes } from "./outcomes-math";
import { assertManages, managedMemberships } from "./scope";

const PERM = "staff.reviews" as const;
const DAY = 86_400_000;

function staffOnly(viewer: Viewer) {
  if (!viewer.workspace || (viewer.persona !== "staff" && viewer.persona !== "admin")) throw new ViewerError("FORBIDDEN");
  return viewer.workspace.id;
}

function checkPeriod(from: Date, to: Date) {
  if (!(to > from)) throw new UserError("The period must end after it starts.");
  if (to.getTime() - from.getTime() > 400 * DAY) throw new UserError("Choose a period of up to about a year.");
}

/** One tutor's outcomes over [from, to). */
export async function outcomesFor(membershipId: string, from: Date, to: Date, now: Date = new Date()): Promise<TutorOutcomes> {
  const courses = await prisma.course.findMany({
    where: { OR: [{ staff: { some: { membershipId } } }, { ownerMembershipId: membershipId, staff: { none: {} } }] },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);
  const range = { gte: from, lt: to };
  const dueRange = { gte: from, lt: new Date(Math.min(to.getTime(), now.getTime())) };
  const months = monthsBetween(from, to);
  const [enrolments, grades, tests, assignments, attendance, riskOpened, riskResolved, sheets, bookings] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId: { in: courseIds }, endedAt: null }, select: { courseId: true, learner: { select: { id: true, user: { select: { studentProfile: { select: { id: true } } } } } } } }),
    prisma.grade.findMany({ where: { courseId: { in: courseIds }, createdAt: range, outOf: { gt: 0 } }, select: { studentId: true, score: true, outOf: true, createdAt: true } }),
    prisma.test.findMany({ where: { courseId: { in: courseIds }, isActive: true, dueDate: dueRange }, select: { courseId: true, _count: { select: { submissions: { where: { status: { not: "IN_PROGRESS" } } } } } } }),
    prisma.submission.findMany({ where: { courseId: { in: courseIds }, isActive: { not: false }, dueDate: dueRange }, select: { courseId: true, _count: { select: { entries: true } } } }),
    prisma.sessionAttendance.findMany({ where: { event: { courseId: { in: courseIds } }, occurrenceStart: range }, select: { status: true } }),
    prisma.riskAlert.count({ where: { courseId: { in: courseIds }, firstSeenAt: range } }),
    prisma.riskAlert.count({ where: { courseId: { in: courseIds }, closedAt: range, status: "RESOLVED" } }),
    prisma.timesheet.findMany({ where: { membershipId, status: "APPROVED", month: { in: months } }, select: { totalMinutes: true } }),
    prisma.booking.groupBy({ by: ["status"], where: { membershipId, startsAt: range, status: { in: ["COMPLETED", "NO_SHOW"] } }, _count: true }),
  ]);
  const studentsPerCourse = new Map<string, number>();
  for (const e of enrolments) studentsPerCourse.set(e.courseId, (studentsPerCourse.get(e.courseId) ?? 0) + 1);
  const expected = [...tests, ...assignments].reduce((n, w) => n + (studentsPerCourse.get(w.courseId) ?? 0), 0);
  const handed = tests.reduce((n, t) => n + t._count.submissions, 0) + assignments.reduce((n, a) => n + a._count.entries, 0);
  return computeOutcomes({
    courses: courseIds.length,
    activeStudents: new Set(enrolments.map((e) => e.learner.id)).size,
    marks: grades.map((g) => ({ student: g.studentId, at: g.createdAt, percent: (g.score / g.outOf) * 100 })),
    workExpected: expected,
    workHandedIn: handed,
    attendance,
    riskOpened,
    riskResolved,
    approvedMinutes: sheets.reduce((n, s) => n + s.totalMinutes, 0),
    bookingsCompleted: bookings.find((b) => b.status === "COMPLETED")?._count ?? 0,
    bookingsNoShow: bookings.find((b) => b.status === "NO_SHOW")?._count ?? 0,
  });
}

/** Outcomes for the tutors in the viewer's scope (or only their own), one row each. */
export async function listTutorOutcomes(viewer: Viewer, input: { from: Date; to: Date; membershipIds?: string[] }) {
  const workspaceId = staffOnly(viewer);
  checkPeriod(input.from, input.to);
  const sees = can(viewer, PERM) || can(viewer, "reports.view");
  const scope = sees ? await managedMemberships(viewer, can(viewer, PERM) ? PERM : "reports.view") : [viewer.membership?.id ?? "-"];
  const members = await prisma.membership.findMany({
    where: {
      workspaceId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "TUTOR"] },
      ...(scope === "ALL" ? {} : { id: { in: scope } }),
      ...(input.membershipIds?.length ? { id: { in: input.membershipIds } } : {}),
      OR: [{ courseStaff: { some: {} } }, { ownedCourses: { some: {} } }],
    },
    take: 200,
    select: { id: true, user: { select: { name: true } } },
  });
  const out = [];
  for (const m of members) out.push({ membershipId: m.id, name: m.user.name, outcomes: await outcomesFor(m.id, input.from, input.to) });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------------- */
/* Reviews                                                                   */
/* ------------------------------------------------------------------------- */

const reviewSelect = {
  id: true, membershipId: true, reviewerUserId: true, periodStart: true, periodEnd: true, outcomes: true, strengths: true, improvements: true,
  goals: true, rating: true, status: true, sharedAt: true, acknowledgedAt: true, response: true, createdAt: true, updatedAt: true,
} as const;

/** A manager starts a review for a tutor and period; the outcomes are saved with it. Not for themselves. */
export async function createReview(viewer: Viewer, input: { membershipId: string; from: Date; to: Date }) {
  const workspaceId = staffOnly(viewer);
  checkPeriod(input.from, input.to);
  if (!can(viewer, PERM) || (await assertManages(viewer, input.membershipId, PERM)) !== "manager") throw new ViewerError("FORBIDDEN");
  if (input.membershipId === viewer.membership?.id) throw new UserError("Someone else must review you.");
  const outcomes = await outcomesFor(input.membershipId, input.from, input.to);
  return prisma.staffReview.create({
    data: { workspaceId, membershipId: input.membershipId, reviewerUserId: viewer.user.id, periodStart: input.from, periodEnd: input.to, outcomes: outcomes as unknown as Prisma.InputJsonValue },
    select: reviewSelect,
  });
}

async function reviewFor(viewer: Viewer, id: string) {
  const workspaceId = staffOnly(viewer);
  const r = await prisma.staffReview.findUnique({ where: { id } });
  if (!r || r.workspaceId !== workspaceId) throw new UserError("That review no longer exists.");
  return r;
}

/** The reviewer (or another manager in scope) edits a draft or shared review; acknowledged reviews are closed. */
export async function updateReview(viewer: Viewer, input: { id: string; strengths?: string | null; improvements?: string | null; goals?: string | null; rating?: number | null; refreshOutcomes?: boolean }) {
  const r = await reviewFor(viewer, input.id);
  if (!can(viewer, PERM) || (await assertManages(viewer, r.membershipId, PERM)) !== "manager" || r.membershipId === viewer.membership?.id) throw new ViewerError("FORBIDDEN");
  if (r.status === "ACKNOWLEDGED") throw new UserError("This review has been acknowledged. Start a new one instead.");
  if (input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) throw new UserError("Ratings are 1 to 5.");
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim().slice(0, 4000) || null);
  return prisma.staffReview.update({
    where: { id: r.id },
    data: {
      strengths: text(input.strengths), improvements: text(input.improvements), goals: text(input.goals),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.refreshOutcomes ? { outcomes: (await outcomesFor(r.membershipId, r.periodStart, r.periodEnd)) as unknown as Prisma.InputJsonValue } : {}),
    },
    select: reviewSelect,
  });
}

/** Shares a review with the tutor (in-app note). */
export async function shareReview(viewer: Viewer, input: { id: string }) {
  const r = await reviewFor(viewer, input.id);
  if (!can(viewer, PERM) || (await assertManages(viewer, r.membershipId, PERM)) !== "manager" || r.membershipId === viewer.membership?.id) throw new ViewerError("FORBIDDEN");
  if (r.status !== "DRAFT") throw new UserError("This review has already been shared.");
  if (!r.strengths && !r.improvements && !r.goals) throw new UserError("Write something before sharing it.");
  await prisma.staffReview.update({ where: { id: r.id }, data: { status: "SHARED", sharedAt: new Date() } });
  const m = await prisma.membership.findUniqueOrThrow({ where: { id: r.membershipId }, select: { userId: true } });
  await emitNotification({ title: "You have a new review", message: `From ${viewer.user.name}. Read it and add your reply.`, type: "SYSTEM", userIds: [m.userId], link: `/dashboard/reviews/${r.id}` }, { revalidate: false, email: true }).catch(() => undefined);
  return { ok: true as const };
}

/** The tutor acknowledges a shared review, optionally with a reply. */
export async function acknowledgeReview(viewer: Viewer, input: { id: string; response?: string | null }) {
  const r = await reviewFor(viewer, input.id);
  if (r.membershipId !== viewer.membership?.id) throw new ViewerError("FORBIDDEN");
  if (r.status !== "SHARED") throw new UserError(r.status === "DRAFT" ? "This review hasn't been shared with you yet." : "You've already acknowledged this review.");
  await prisma.staffReview.update({ where: { id: r.id }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), response: input.response?.trim().slice(0, 2000) || null } });
  return { ok: true as const };
}

/** Reviews: a tutor sees their own shared ones; a manager sees those for staff in scope (drafts too). */
export async function listReviews(viewer: Viewer, input: { membershipId?: string }) {
  const workspaceId = staffOnly(viewer);
  const me = viewer.membership?.id ?? "-";
  let where: Prisma.StaffReviewWhereInput;
  if (can(viewer, PERM)) {
    const scope = await managedMemberships(viewer, PERM);
    const others = scope === "ALL" ? { membershipId: { not: me } } : { membershipId: { in: scope.filter((s) => s !== me) } };
    where = { workspaceId, OR: [others, { membershipId: me, status: { not: "DRAFT" } }], ...(input.membershipId ? { membershipId: input.membershipId } : {}) };
  } else {
    where = { workspaceId, membershipId: me, status: { not: "DRAFT" } };
  }
  const rows = await prisma.staffReview.findMany({ where, orderBy: { periodEnd: "desc" }, take: 200, select: { ...reviewSelect, membership: { select: { user: { select: { name: true } } } } } });
  const reviewers = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.reviewerUserId))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map(({ membership, ...r }) => ({ ...r, tutorName: membership.user.name, reviewerName: reviewers.get(r.reviewerUserId) ?? "" }));
}
