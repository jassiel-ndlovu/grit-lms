/**
 * Course queries — server-only data access for the courses feature.
 *
 * These run inside React Server Components, Route Handlers, and Server
 * Actions. Each top-level export is wrapped in React's `cache()` so the
 * same call is deduplicated across a request.
 *
 * Two shapes are exposed:
 *   - List queries return lightweight `Course` rows + minimal relations
 *     suitable for cards/grids.
 *   - `getCourseDetailById` returns the full relation graph (lessons,
 *     attachments, quizzes, tests, students, events) used by the
 *     manage-course page and student course page.
 *
 * The legacy /api/courses route returned everything, always; that became
 * a problem as relation depth grew. The list/detail split keeps card pages
 * fast while still giving detail pages the full picture.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------------- */
/* List queries                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Compact include shape used by all list queries — enough to render a
 * course card (cover, tutor name, lesson count) without dragging along
 * every relation.
 */
const listInclude = {
  tutor: true,
  _count: {
    select: {
      lessons: true,
      students: true,
      quizzes: true,
      tests: true,
    },
  },
} as const;

export type CourseListItem = Awaited<ReturnType<typeof listAllCourses>>[number];

/**
 * All courses — used by the public browse page.
 */
export const listAllCourses = cache(async () => {
  return prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: listInclude,
  });
});

/**
 * Courses owned by a tutor — used by /dashboard/manage-courses.
 */
export const listCoursesByTutorId = cache(async (tutorId: string) => {
  return prisma.course.findMany({
    where: { tutorId },
    orderBy: { createdAt: "desc" },
    include: listInclude,
  });
});

/**
 * Courses a student is enrolled in — used by /dashboard/courses.
 */
export const listCoursesByStudentId = cache(async (studentId: string) => {
  return prisma.course.findMany({
    where: { students: { some: { id: studentId } } },
    orderBy: { createdAt: "desc" },
    include: listInclude,
  });
});

/**
 * Courses by a list of IDs — preserves the legacy `?ids=a,b,c` shape for
 * any caller that needs it (notifications deep-link).
 */
export const listCoursesByIds = cache(async (ids: string[]) => {
  if (ids.length === 0) return [];
  return prisma.course.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
    include: listInclude,
  });
});

/* ------------------------------------------------------------------------- */
/* Detail queries                                                            */
/* ------------------------------------------------------------------------- */

const detailInclude = {
  tutor: true,
  students: true,
  lessons: {
    orderBy: { order: "asc" },
    include: {
      attachmentUrls: true,
      completions: { select: { studentId: true } },
    },
  },
  quizzes: { orderBy: { createdAt: "desc" } },
  tests: { orderBy: { createdAt: "desc" } },
  courseEvents: { orderBy: { date: "asc" } },
} as const;

export type CourseDetail = NonNullable<
  Awaited<ReturnType<typeof getCourseDetailById>>
>;

/**
 * Full course graph by ID — used by manage-course detail page and the
 * student course page. Returns null if not found (callers should
 * `notFound()` from there).
 */
export const getCourseDetailById = cache(async (id: string) => {
  return prisma.course.findUnique({
    where: { id },
    include: detailInclude,
  });
});

/**
 * Lightweight ownership check — does a tutor own this course?
 * Used by the update/delete actions before mutating.
 */
export const courseBelongsToTutor = cache(
  async (courseId: string, tutorId: string) => {
    const c = await prisma.course.findUnique({
      where: { id: courseId },
      select: { tutorId: true },
    });
    return c?.tutorId === tutorId;
  },
);
