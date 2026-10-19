/**
 * Global search — the header search box.
 *
 * One query per content type, each scoped to what the signed-in user can
 * open:
 *   - STUDENT: courses they're enrolled in, and the lessons, active tests,
 *     active assignments and events of those courses.
 *   - TUTOR: the courses they own and everything inside them.
 *   - ADMIN: user accounts (the only surface the admin portal has).
 *   - PARENT: nothing yet — the parent portal has no content pages.
 *
 * Every hit carries the href of the page that role should land on, so the
 * client just renders links. Matching is a case-insensitive substring on
 * titles (and descriptions where they're short enough to be useful).
 */

import "server-only";

import type { Session } from "next-auth";

import { prisma } from "@/lib/db";

import type { SearchGroup, SearchHit } from "./schemas";

/** Hits per group — the dropdown is a jump list, not a results page. */
const PER_GROUP = 5;

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

export async function searchForUser(
  session: Session,
  rawQuery: string,
): Promise<SearchGroup[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  switch (session.user.role) {
    case "STUDENT":
      return searchAsStudent(session.user.email, q);
    case "TUTOR":
      return searchAsTutor(session.user.email, q);
    case "ADMIN":
      return searchAsAdmin(q);
    default:
      return [];
  }
}

/* ------------------------------------------------------------------------- */
/* Student                                                                    */
/* ------------------------------------------------------------------------- */

async function searchAsStudent(email: string, q: string): Promise<SearchGroup[]> {
  const student = await prisma.student.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!student) return [];

  const enrolled = { students: { some: { id: student.id } } };

  const [courses, lessons, tests, assignments, events] = await Promise.all([
    prisma.course.findMany({
      where: { ...enrolled, OR: [{ name: ci(q) }, { description: ci(q) }] },
      select: { id: true, name: true, tutor: { select: { fullName: true } } },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    prisma.lesson.findMany({
      // Group headings (NONE) have no page of their own to open.
      where: { course: enrolled, type: { not: "NONE" }, title: ci(q) },
      select: { id: true, title: true, course: { select: { id: true, name: true } } },
      orderBy: { title: "asc" },
      take: PER_GROUP,
    }),
    prisma.test.findMany({
      where: {
        course: enrolled,
        isActive: true,
        OR: [{ title: ci(q) }, { description: ci(q) }],
      },
      select: {
        id: true,
        title: true,
        course: { select: { name: true } },
        submissions: {
          where: { studentId: student.id },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { dueDate: "asc" },
      take: PER_GROUP,
    }),
    prisma.submission.findMany({
      where: {
        course: enrolled,
        isActive: true,
        OR: [{ title: ci(q) }, { description: ci(q) }],
      },
      select: { id: true, title: true, course: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: PER_GROUP,
    }),
    searchEvents({ course: enrolled }, q),
  ]);

  return compact([
    group("courses", "Courses", courses.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: c.tutor.fullName,
      href: `/dashboard/courses/${c.id}`,
    }))),
    group("lessons", "Lessons", lessons.map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.course.name,
      href: `/dashboard/courses/lessons/${l.course.id}?lesson=${l.id}`,
    }))),
    group("tests", "Tests", tests.map((t) => {
      // Same routing as the tests list: finished attempts open the review,
      // anything else the pre-test page.
      const status = t.submissions[0]?.status;
      const done = status === "GRADED" || status === "SUBMITTED";
      return {
        id: t.id,
        title: t.title,
        subtitle: t.course.name,
        href: done ? `/dashboard/tests/review/${t.id}` : `/dashboard/tests/pre-test/${t.id}`,
      };
    })),
    group("assignments", "Assignments", assignments.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.course.name,
      href: `/dashboard/submissions/${s.id}`,
    }))),
    group("events", "Events", events),
  ]);
}

/* ------------------------------------------------------------------------- */
/* Tutor                                                                      */
/* ------------------------------------------------------------------------- */

async function searchAsTutor(email: string, q: string): Promise<SearchGroup[]> {
  const tutor = await prisma.tutor.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!tutor) return [];

  const owned = { tutorId: tutor.id };

  const [courses, lessons, tests, assignments, events] = await Promise.all([
    prisma.course.findMany({
      where: { ...owned, OR: [{ name: ci(q) }, { description: ci(q) }] },
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    prisma.lesson.findMany({
      where: { course: owned, title: ci(q) },
      select: { id: true, title: true, course: { select: { id: true, name: true } } },
      orderBy: { title: "asc" },
      take: PER_GROUP,
    }),
    prisma.test.findMany({
      where: { course: owned, OR: [{ title: ci(q) }, { description: ci(q) }] },
      select: { id: true, title: true, course: { select: { name: true } } },
      orderBy: { dueDate: "desc" },
      take: PER_GROUP,
    }),
    prisma.submission.findMany({
      where: { course: owned, OR: [{ title: ci(q) }, { description: ci(q) }] },
      select: { id: true, title: true, course: { select: { name: true } } },
      orderBy: { dueDate: "desc" },
      take: PER_GROUP,
    }),
    searchEvents({ course: owned }, q),
  ]);

  return compact([
    group("courses", "Courses", courses.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: `${c._count.students} student${c._count.students === 1 ? "" : "s"}`,
      href: `/dashboard/manage-courses/${c.id}`,
    }))),
    group("lessons", "Lessons", lessons.map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.course.name,
      href: `/dashboard/manage-courses/lessons/${l.course.id}?lesson=${l.id}`,
    }))),
    group("tests", "Tests", tests.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.course.name,
      href: `/dashboard/tutor-tests/${t.id}/submissions`,
    }))),
    group("assignments", "Assignments", assignments.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.course.name,
      href: `/dashboard/submissions/${s.id}`,
    }))),
    group("events", "Events", events),
  ]);
}

/* ------------------------------------------------------------------------- */
/* Admin                                                                      */
/* ------------------------------------------------------------------------- */

async function searchAsAdmin(q: string): Promise<SearchGroup[]> {
  const users = await prisma.user.findMany({
    where: { OR: [{ name: ci(q) }, { email: ci(q) }] },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: PER_GROUP * 2,
  });

  return compact([
    group("users", "Users", users.map((u) => ({
      id: u.id,
      title: u.name || u.email,
      subtitle: `${u.role.toLowerCase()} · ${u.email}`,
      href: "/dashboard/manage-users",
    }))),
  ]);
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

async function searchEvents(
  scope: { course: Record<string, unknown> },
  q: string,
): Promise<SearchHit[]> {
  const events = await prisma.courseEvent.findMany({
    where: { ...scope, OR: [{ title: ci(q) }, { description: ci(q) }] },
    select: { id: true, title: true, course: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: PER_GROUP,
  });
  // The calendar has no per-event page; the list view is the closest
  // place an event can be found by eye.
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    subtitle: e.course.name,
    href: "/dashboard/calendar?view=list",
  }));
}

function group(key: string, label: string, hits: SearchHit[]): SearchGroup {
  return { key, label, hits };
}

function compact(groups: SearchGroup[]): SearchGroup[] {
  return groups.filter((g) => g.hits.length > 0);
}
