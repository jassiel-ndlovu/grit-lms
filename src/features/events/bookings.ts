/**
 * Session booking for B's pages: who can be booked for what, over A's
 * services (features/booking). Every list here only narrows what to show;
 * A's functions check again. Server only.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { hasService } from "@/features/billing/services";
import { BOOKING_SERVICE, listBookings, type BookingRow } from "@/features/booking/bookings";
import { creditSummary, type CreditSummary } from "@/features/booking/credits";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { can, courseScopeOf, scopedCourseWhere, type Viewer } from "@/lib/viewer";

import type { CalendarEntry } from "./lib/calendar-ui";
import { bookingRoutes } from "./lib/booking-ui";

const DAY = 86_400_000;

/** Staff who use the booking pages: anyone in a workspace who can see its courses. */
export function booksAsStaff(viewer: Viewer): boolean {
  return viewer.persona === "staff" && viewer.workspace !== null && can(viewer, "content.view");
}

export function booksAsFamily(viewer: Viewer): boolean {
  return viewer.persona === "learner" || viewer.persona === "guardian";
}

/** Tutors of the course with hours families can book, A's rule in `bookableTutors`. */
const takesBookings = (courseId: string): Prisma.CourseStaffWhereInput => ({
  courseId,
  membership: { bookingAvailability: { some: { OR: [{ courseId: null }, { courseId }] } } },
});

/** Why a course can't be booked yet, or "open". */
async function bookingState(viewer: Viewer, courseId: string): Promise<"open" | "plan" | "hours"> {
  if (!(await hasService(viewer, courseId, BOOKING_SERVICE))) return "plan";
  return (await prisma.courseStaff.count({ where: takesBookings(courseId) })) > 0 ? "open" : "hours";
}

/* ------------------------------------------------------------------------- */
/* Families                                                                  */
/* ------------------------------------------------------------------------- */

export type FamilyLearner = { learnerId: string; userId: string; name: string; workspaceName: string; payer: boolean };

/** The viewer as a learner, or the children they look after: one row per workspace. */
export async function familyLearners(viewer: Viewer): Promise<FamilyLearner[]> {
  const userIds = viewer.persona === "learner" ? [viewer.user.id] : viewer.persona === "guardian" ? viewer.children.map((c) => c.userId) : [];
  if (userIds.length === 0) return [];
  const rows = await prisma.learner.findMany({
    where: { userId: { in: userIds }, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, paymentVisible: true, user: { select: { name: true } }, workspace: { select: { name: true } } },
  });
  return rows.map((r) => ({
    learnerId: r.id,
    userId: r.userId,
    name: r.user.name,
    workspaceName: r.workspace.name,
    payer: viewer.persona === "guardian" ? can(viewer, "fees.pay") : r.paymentVisible,
  }));
}

export type BookableCourse = { courseId: string; courseName: string; students: Array<{ learnerId: string; name: string }> };

/** The courses a family can book now, with the children on each. */
export async function familyCourses(viewer: Viewer, learners: readonly FamilyLearner[]): Promise<BookableCourse[]> {
  if (learners.length === 0) return [];
  const enrolled = await prisma.enrollment.findMany({
    where: { learnerId: { in: learners.map((l) => l.learnerId) }, endedAt: null, status: "ACTIVE" },
    orderBy: { course: { name: "asc" } },
    select: { learnerId: true, course: { select: { id: true, name: true } } },
  });
  const courses = new Map<string, BookableCourse>();
  for (const e of enrolled) {
    const c = courses.get(e.course.id) ?? { courseId: e.course.id, courseName: e.course.name, students: [] };
    c.students.push({ learnerId: e.learnerId, name: learners.find((l) => l.learnerId === e.learnerId)?.name ?? "" });
    courses.set(e.course.id, c);
  }
  return onlyOpen(viewer, [...courses.values()]);
}

async function onlyOpen<T extends { courseId: string }>(viewer: Viewer, courses: T[]): Promise<T[]> {
  const states = await Promise.all(courses.map((c) => bookingState(viewer, c.courseId)));
  return courses.filter((_, i) => states[i] === "open");
}

export type LearnerCredits = FamilyLearner & { courses: CreditSummary[] };

/** Lessons left on packs, for courses that sell them or where some are left. */
export async function familyCredits(learners: readonly FamilyLearner[]): Promise<LearnerCredits[]> {
  const out: LearnerCredits[] = [];
  for (const l of learners) {
    const courses = (await learnerCredits(l.learnerId)).filter((c) => c.needsCredits || c.balance !== 0);
    if (courses.length) out.push({ ...l, courses });
  }
  return out;
}

async function learnerCredits(learnerId: string, only?: ReadonlySet<string>): Promise<CreditSummary[]> {
  const ids = (await prisma.enrollment.findMany({ where: { learnerId, endedAt: null }, select: { courseId: true } })).map((e) => e.courseId);
  const wanted = only ? ids.filter((id) => only.has(id)) : ids;
  if (wanted.length === 0) return [];
  return (await creditSummary(learnerId, wanted)).sort((a, b) => a.courseName.localeCompare(b.courseName));
}

/* ------------------------------------------------------------------------- */
/* Staff                                                                     */
/* ------------------------------------------------------------------------- */

const inScope = (viewer: Viewer, permission: "content.view" | "courses.edit" | "fees.manage"): Prisma.CourseWhereInput => {
  const scope = courseScopeOf(viewer, permission);
  return { workspaceId: viewer.workspace?.id ?? "-", ...(scope ? scopedCourseWhere(scope) : {}) };
};

/** The courses staff can book for a student, and whether any is held back by the plan. */
export async function staffCourses(viewer: Viewer): Promise<{ courses: BookableCourse[]; needPlan: boolean; needHours: boolean }> {
  const rows = await prisma.course.findMany({
    where: inScope(viewer, "content.view"),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      enrollments: { where: { endedAt: null, status: "ACTIVE" }, select: { learnerId: true, learner: { select: { user: { select: { name: true } } } } } },
    },
  });
  const states = await Promise.all(rows.map((r) => bookingState(viewer, r.id)));
  return {
    needPlan: states.length > 0 && states.every((s) => s === "plan"),
    needHours: states.includes("hours"),
    courses: rows
      .filter((_, i) => states[i] === "open")
      .map((r) => ({
        courseId: r.id,
        courseName: r.name,
        students: r.enrollments.map((e) => ({ learnerId: e.learnerId, name: e.learner.user.name })).sort((a, b) => a.name.localeCompare(b.name)),
      })),
  };
}

/** Filters for the staff list: courses they edit that have bookings, and tutors when they arrange cover. */
export async function staffFilters(viewer: Viewer): Promise<{ courses: Array<{ id: string; name: string }>; tutors: Array<{ id: string; name: string }> }> {
  const [courses, tutors] = await Promise.all([
    can(viewer, "courses.edit")
      ? prisma.course.findMany({ where: { ...inScope(viewer, "courses.edit"), bookings: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    managedTutors(viewer),
  ]);
  return { courses, tutors };
}

/** Whose hours this person may set besides their own (`cover.manage`): everyone who teaches. */
export async function managedTutors(viewer: Viewer): Promise<Array<{ id: string; name: string }>> {
  if (!viewer.workspace || !can(viewer, "cover.manage")) return [];
  const rows = await prisma.membership.findMany({
    where: { workspaceId: viewer.workspace.id, status: "ACTIVE", courseStaff: { some: {} } },
    orderBy: { user: { name: "asc" } },
    select: { id: true, user: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.user.name }));
}

/** The courses a tutor teaches: what their hours can be limited to. */
export async function taughtCourses(membershipId: string): Promise<Array<{ id: string; name: string }>> {
  return prisma.course.findMany({ where: { staff: { some: { membershipId } } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Lesson credits staff may correct for a student (`fees.manage` on the course); null when they can't at all. */
export async function staffCredits(viewer: Viewer, learnerId: string): Promise<CreditSummary[] | null> {
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "fees.manage")) return null;
  const learner = await prisma.learner.findFirst({ where: { id: learnerId, workspaceId: viewer.workspace.id }, select: { id: true } });
  if (!learner) return null;
  const ids = await prisma.course.findMany({ where: inScope(viewer, "fees.manage"), select: { id: true } });
  return learnerCredits(learnerId, new Set(ids.map((c) => c.id)));
}

/* ------------------------------------------------------------------------- */
/* Lists                                                                     */
/* ------------------------------------------------------------------------- */

/** A family's lessons: upcoming (and running) ones, or the last 90 days. */
export async function familyBookings(viewer: Viewer, view: "upcoming" | "past", now: Date): Promise<BookingRow[]> {
  if (view === "upcoming") {
    // 180 days is the furthest anyone can book; A lists 93 at a time.
    const [near, far] = await Promise.all([
      listBookings(viewer, { from: now, to: new Date(now.getTime() + 93 * DAY) }, now),
      listBookings(viewer, { from: new Date(now.getTime() + 93 * DAY), to: new Date(now.getTime() + 186 * DAY) }, now),
    ]);
    const seen = new Set<string>();
    return [...near, ...far].filter((b) => b.status === "BOOKED" && !seen.has(b.id) && seen.add(b.id));
  }
  const rows = await listBookings(viewer, { from: new Date(now.getTime() - 90 * DAY), to: new Date(now.getTime() + 93 * DAY) }, now);
  return rows.filter((b) => b.endsAt <= now || b.status !== "BOOKED").reverse();
}

/** Booked lessons as calendar entries: a tutor's own, a student's, or one child's. */
export async function bookingEntries(viewer: Viewer, range: { from: string; to: string }, childUserId?: string | null): Promise<CalendarEntry[]> {
  if (!booksAsFamily(viewer) && !booksAsStaff(viewer)) return [];
  const rows = await listBookings(viewer, { from: new Date(range.from), to: new Date(range.to) });
  const family = booksAsFamily(viewer);
  return rows
    .filter((b) => (b.status === "BOOKED" || b.status === "COMPLETED") && (!childUserId || b.student.userId === childUserId))
    .map((b) => ({
      id: `booking:${b.id}`,
      kind: "booking" as const,
      eventId: null,
      occurrenceStart: null,
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      title: family ? `Lesson with ${b.tutor.name}` : `Lesson: ${b.student.name}`,
      description: b.note,
      type: null,
      location: null,
      link: b.meetingLink,
      cancelled: false,
      changed: false,
      recurring: false,
      courseId: b.course.id,
      courseName: b.course.name,
      href: bookingRoutes.home,
    }));
}

/** Buying a pack needs billing on (January). */
export const packsForSale = isBillingEnabled;
