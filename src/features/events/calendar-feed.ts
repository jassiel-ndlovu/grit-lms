/**
 * Server half of the calendar page (#149): the rows A's
 * `listCalendarOccurrences` doesn't cover. Tests and assignments due in the
 * range (students: their own; tutors: their courses'), and the courses one
 * child is enrolled in, so a parent sees one child at a time.
 */

import "server-only";

import { listActiveTestsByCourseId, listActiveTestsForStudent } from "@/features/assessments/queries";
import { listActiveSubmissionsByCourseId, listActiveSubmissionsForStudent } from "@/features/assignments/queries";
import { assignmentRoutes } from "@/features/assignments/routes";
import { prisma } from "@/lib/db";

import type { CalendarEntry } from "./lib/calendar-ui";

type Due = { id: string; title: string; dueDate: Date | null; description?: string | null; course: { id: string; name: string } };

function dueEntry(kind: "test" | "assignment", d: Due, href: string): CalendarEntry {
  return {
    id: `${kind}:${d.id}`, kind, eventId: null, occurrenceStart: null, start: d.dueDate!.toISOString(), end: null, title: d.title,
    description: d.description ?? null, type: null, location: null, link: null, cancelled: false, changed: false, recurring: false,
    courseId: d.course.id, courseName: d.course.name, href,
  };
}

const inRange = (range: { from: string; to: string }) => (d: Due) =>
  d.dueDate != null && d.dueDate.toISOString() >= range.from && d.dueDate.toISOString() < range.to;

/** A student's tests and assignments due in the range (legacy Student row, as before). */
export async function dueForStudent(email: string, range: { from: string; to: string }): Promise<CalendarEntry[]> {
  const student = await prisma.student.findUnique({ where: { email }, select: { id: true } });
  if (!student) return [];
  const [tests, subs] = await Promise.all([listActiveTestsForStudent(student.id), listActiveSubmissionsForStudent(student.id)]);
  return [
    ...(tests as Due[]).filter(inRange(range)).map((t) => dueEntry("test", t, `/dashboard/tests/pre-test/${t.id}`)),
    ...(subs as Due[]).filter(inRange(range)).map((s) => dueEntry("assignment", s, assignmentRoutes.detail(s.id))),
  ];
}

/** Tests and assignments due in the range on the tutor's courses. */
export async function dueForCourses(courses: Array<{ id: string; name: string }>, range: { from: string; to: string }): Promise<CalendarEntry[]> {
  const per = await Promise.all(
    courses.map(async (c) => {
      const [tests, subs] = await Promise.all([listActiveTestsByCourseId(c.id), listActiveSubmissionsByCourseId(c.id)]);
      const course = { id: c.id, name: c.name };
      return [
        ...tests.map((t) => ({ ...t, course })).filter(inRange(range)).map((t) => dueEntry("test", t, "/dashboard/tutor-tests")),
        ...subs.map((s) => ({ ...s, course })).filter(inRange(range)).map((s) => dueEntry("assignment", s, assignmentRoutes.detail(s.id))),
      ];
    }),
  );
  return per.flat();
}

/** The courses a child is enrolled in now (the caller has checked the guardianship). */
export async function childCourseIds(childUserId: string): Promise<Set<string>> {
  const rows = await prisma.enrollment.findMany({ where: { endedAt: null, learner: { userId: childUserId } }, select: { courseId: true } });
  return new Set(rows.map((r) => r.courseId));
}
