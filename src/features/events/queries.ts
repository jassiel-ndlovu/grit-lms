/**
 * Course event (schedule) queries — server-only.
 *
 * CourseEvent rows attach to a course and surface in calendar/schedule UIs.
 * Replaces /api/events GET. No notifications side-effects historically.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { enrolledStudent, ownerTutor } from "@/features/courses/lib/tenancy-where";
import { manageableBy, type CourseScope } from "@/features/courses/lib/course-access";

/**
 * A repeating event's `date` column holds only the FIRST occurrence, so a
 * weekly lecture that started in February is "in the past" by that column
 * while still running today. Anything filtering for upcoming events has to
 * let those rows through and leave the real filtering to
 * expandOccurrences() - see features/events/lib/recurrence.ts.
 */
function upcomingOrRecurring(from: Date) {
  return {
    OR: [
      { date: { gte: from } },
      {
        repeatFrequency: { not: "NONE" as const },
        OR: [{ repeatUntil: null }, { repeatUntil: { gte: from } }],
      },
    ],
  };
}

export type CourseEventListItem = Awaited<
  ReturnType<typeof listEventsByCourseId>
>[number];

/** All events for one course, soonest first. */
export const listEventsByCourseId = cache(async (courseId: string) => {
  return prisma.courseEvent.findMany({
    where: { courseId },
    orderBy: { date: "asc" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          ownerMembership: ownerTutor,
        },
      },
    },
  });
});

/**
 * All upcoming events across every course a student is enrolled in.
 * Used by the global student schedule page.
 */
export const listUpcomingEventsForStudent = cache(async (studentId: string) => {
  return prisma.courseEvent.findMany({
    where: {
      ...upcomingOrRecurring(new Date()),
      course: enrolledStudent(studentId),
    },
    orderBy: { date: "asc" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          ownerMembership: ownerTutor,
        },
      },
    },
  });
});

/** All events across every course owned by a tutor. */
export const listUpcomingEventsForTutor = cache(async (scope: CourseScope) => {
  return prisma.courseEvent.findMany({
    where: {
      ...upcomingOrRecurring(new Date()),
      course: manageableBy(scope),
    },
    orderBy: { date: "asc" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          ownerMembership: ownerTutor,
        },
      },
    },
  });
});

/** Ownership: does the event live under a course owned by this tutor? */
export const eventBelongsToTutor = cache(
  async (eventId: string, scope: CourseScope) => {
    const n = await prisma.courseEvent.count({ where: { id: eventId, course: manageableBy(scope) } });
    return n > 0;
  },
);
