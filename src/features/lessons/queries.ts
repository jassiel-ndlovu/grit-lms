/**
 * Lesson queries — server-only data access for the lessons feature.
 *
 * These run inside React Server Components, Route Handlers, and Server
 * Actions. Each top-level export is wrapped in React's `cache()` so the
 * same call is deduplicated across a request.
 *
 * Two shapes are exposed:
 *   - List queries (`listLessonsByCourseId`) return rows + attachments and
 *     a count of completions per lesson — enough for the manage and student
 *     sidebars without dragging the full Course graph along.
 *   - `getLessonDetailById` returns a single lesson with attachments and
 *     the calling student's completion (if any) — used by the lesson view.
 *
 * Ownership / completion helpers (`lessonBelongsToTutor`,
 * `getLessonCompletionForStudent`) are pulled out so Server Actions and
 * pages can share the same checks without re-implementing them.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------------- */
/* List queries                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Compact include shape for lesson lists — attachments, video URLs are on
 * the row already, and we add a count of completions for progress chips.
 */
const listInclude = {
  attachmentUrls: true,
  _count: { select: { completions: true } },
} as const;

export type LessonListItem = Awaited<
  ReturnType<typeof listLessonsByCourseId>
>[number];

/**
 * Lessons for a course, ordered by `order` then by createdAt as a stable
 * tiebreak — used by both manage-lessons (tutor) and the course-lessons
 * page (student).
 */
export const listLessonsByCourseId = cache(async (courseId: string) => {
  return prisma.lesson.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: listInclude,
  });
});

/* ------------------------------------------------------------------------- */
/* Detail queries                                                            */
/* ------------------------------------------------------------------------- */

const detailInclude = {
  attachmentUrls: true,
  course: {
    select: {
      id: true,
      name: true,
      tutor: { select: { id: true, fullName: true, email: true } },
    },
  },
} as const;

export type LessonDetail = NonNullable<
  Awaited<ReturnType<typeof getLessonDetailById>>
>;

/**
 * Full lesson by ID, with attachments and a minimal course/tutor summary.
 * Returns null if not found (callers should `notFound()` from there).
 */
export const getLessonDetailById = cache(async (id: string) => {
  return prisma.lesson.findUnique({
    where: { id },
    include: detailInclude,
  });
});

/* ------------------------------------------------------------------------- */
/* Ownership / completion helpers                                            */
/* ------------------------------------------------------------------------- */

/**
 * Does a tutor own the course this lesson belongs to?
 * Used by update/delete actions before mutating.
 */
export const lessonBelongsToTutor = cache(
  async (lessonId: string, tutorId: string) => {
    const l = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { course: { select: { tutorId: true } } },
    });
    return l?.course.tutorId === tutorId;
  },
);

/**
 * The completion row for (studentId, lessonId) if it exists, else null.
 * Cheap one-row lookup — used by the lesson page to decide whether to
 * render "Completed" or "Mark complete".
 */
export const getLessonCompletionForStudent = cache(
  async (studentId: string, lessonId: string) => {
    return prisma.lessonCompletion.findFirst({
      where: { studentId, lessonId },
    });
  },
);

/**
 * All completion rows for a student inside one course — used by the
 * student lesson sidebar to render check-marks next to each lesson.
 */
export const listCompletionsForStudentInCourse = cache(
  async (studentId: string, courseId: string) => {
    return prisma.lessonCompletion.findMany({
      where: { studentId, lesson: { courseId } },
      select: { lessonId: true, completedAt: true },
    });
  },
);
