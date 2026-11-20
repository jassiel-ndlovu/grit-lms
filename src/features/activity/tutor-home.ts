import "server-only";

/**
 * Data for the tutor home (UI draft, Main): what needs marking, what is due
 * or still a draft, this week's numbers and the next sessions.
 *
 * Courses are the ones the tutor teaches (CourseStaff) and students are
 * open Enrollments (issue #93, step 4).
 */

import { prisma } from "@/lib/db";
import { taughtByUser } from "@/features/courses/lib/tenancy-where";
import { occurrencesOf } from "@/features/events/lib/recurrence";

import { attentionRows, type AttentionRow, type AttentionSource } from "./lib/attention";

const WAITING = { status: { in: ["SUBMITTED", "LATE"] as ("SUBMITTED" | "LATE")[] } };
const DAY = 24 * 60 * 60 * 1000;

export interface TutorHomeData {
  rows: AttentionRow[];
  stats: { courses: number; students: number; toMark: number; dueThisWeek: number };
  upcoming: { id: string; title: string; course: string; date: Date }[];
}

export async function getTutorHome(teacherUserId: string, now: Date, timeZone: string): Promise<TutorHomeData> {
  const [courses, tests, assignments, events] = await Promise.all([
    prisma.course.findMany({
      where: taughtByUser(teacherUserId),
      select: { id: true, enrollments: { where: { endedAt: null }, select: { learnerId: true } } },
    }),
    prisma.test.findMany({
      where: { course: taughtByUser(teacherUserId) },
      select: {
        id: true,
        title: true,
        dueDate: true,
        isActive: true,
        course: { select: { name: true } },
        _count: { select: { submissions: { where: WAITING } } },
      },
    }),
    prisma.submission.findMany({
      where: { course: taughtByUser(teacherUserId) },
      select: {
        id: true,
        title: true,
        dueDate: true,
        isActive: true,
        course: { select: { name: true } },
        _count: { select: { entries: { where: WAITING } } },
      },
    }),
    prisma.courseEvent.findMany({
      where: { course: taughtByUser(teacherUserId) },
      select: {
        id: true,
        title: true,
        date: true,
        repeatFrequency: true,
        repeatInterval: true,
        repeatWeekdays: true,
        repeatUntil: true,
        repeatCount: true,
        course: { select: { name: true } },
      },
    }),
  ]);

  const sources: AttentionSource[] = [
    ...tests.map((t) => ({
      kind: "test" as const,
      id: t.id,
      title: t.title,
      course: t.course.name,
      dueDate: t.dueDate,
      isActive: t.isActive,
      toMark: t._count.submissions,
    })),
    ...assignments.map((a) => ({
      kind: "assignment" as const,
      id: a.id,
      title: a.title,
      course: a.course.name,
      dueDate: a.dueDate,
      isActive: a.isActive ?? true,
      toMark: a._count.entries,
    })),
  ];
  const rows = attentionRows(sources, now);

  const weekEnd = new Date(now.getTime() + 7 * DAY);
  const upcoming = events
    .flatMap((e) =>
      occurrencesOf(e, now, weekEnd, timeZone).map((date) => ({
        id: `${e.id}#${date.getTime()}`,
        title: e.title,
        course: e.course.name,
        date,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  return {
    rows,
    stats: {
      courses: courses.length,
      students: new Set(courses.flatMap((c) => c.enrollments.map((e) => e.learnerId))).size,
      toMark: sources.reduce((n, s) => n + s.toMark, 0),
      dueThisWeek: rows.filter((r) => r.bucket === "due").length,
    },
    upcoming,
  };
}
