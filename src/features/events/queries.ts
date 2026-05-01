/**
 * Course event (schedule) queries — server-only.
 *
 * CourseEvent rows attach to a course and surface in calendar/schedule UIs.
 * Replaces /api/events GET. No notifications side-effects historically.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

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
          tutor: { select: { id: true, fullName: true } },
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
      date: { gte: new Date() },
      course: { students: { some: { id: studentId } } },
    },
    orderBy: { date: "asc" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          tutor: { select: { id: true, fullName: true } },
        },
      },
    },
  });
});

/** All events across every course owned by a tutor. */
export const listUpcomingEventsForTutor = cache(async (tutorId: string) => {
  return prisma.courseEvent.findMany({
    where: {
      date: { gte: new Date() },
      course: { tutorId },
    },
    orderBy: { date: "asc" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          tutor: { select: { id: true, fullName: true } },
        },
      },
    },
  });
});

/** Ownership: does the event live under a course owned by this tutor? */
export const eventBelongsToTutor = cache(
  async (eventId: string, tutorId: string) => {
    const e = await prisma.courseEvent.findUnique({
      where: { id: eventId },
      select: { course: { select: { tutorId: true } } },
    });
    return e?.course.tutorId === tutorId;
  },
);
