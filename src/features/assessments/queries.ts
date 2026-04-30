/**
 * Assessment (Test + TestQuestion + TestSubmission) queries.
 *
 * Server-only data access for the tests feature. Mirrors the pattern in
 * features/lessons/queries.ts: every top-level export is wrapped in
 * React's `cache()` so duplicate calls during the same request hit Prisma
 * once.
 *
 * Three shapes:
 *   - List queries return compact rows for tutor manage / student catalog
 *     surfaces, with `_count` for status badges.
 *   - Detail queries return the full TestQuestion tree (parent + sub-questions
 *     hydrated client-side via `organizeQuestionsHierarchy` — the tree comes
 *     back flat from Prisma since self-relations don't auto-include).
 *   - Submission queries are scoped by (studentId, testId) — students can
 *     only ever see their own submissions; tutors fetch by testId for grading.
 *
 * Ownership helpers (`testBelongsToTutor`) are exported so Server Actions
 * can short-circuit before mutating and pages can gate entry into a
 * tutor-only view.
 */

import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------------- */
/* List queries                                                              */
/* ------------------------------------------------------------------------- */

const tutorListInclude = {
  course: { select: { id: true, name: true } },
  _count: { select: { questions: true, submissions: true } },
} satisfies Prisma.TestInclude;

export type TestListItem = Awaited<
  ReturnType<typeof listTestsByTutorId>
>[number];

/**
 * Tests owned by a tutor (across all their courses), newest due-date first.
 * Includes question + submission counts for the manage list status pills.
 */
export const listTestsByTutorId = cache(async (tutorId: string) => {
  return prisma.test.findMany({
    where: { course: { tutorId } },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    include: tutorListInclude,
  });
});

/**
 * Active tests across a single course — used inside the student course
 * detail "Assessments" tab. Inactive (draft) tests are filtered out.
 */
export const listActiveTestsByCourseId = cache(async (courseId: string) => {
  return prisma.test.findMany({
    where: { courseId, isActive: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      course: { select: { id: true, name: true } },
      _count: { select: { questions: true, submissions: true } },
    },
  });
});

/**
 * Active tests for every course a student is enrolled in. Used by the
 * student-side tests index.
 */
export const listActiveTestsForStudent = cache(async (studentId: string) => {
  return prisma.test.findMany({
    where: {
      isActive: true,
      course: { students: { some: { id: studentId } } },
    },
    orderBy: { dueDate: "asc" },
    include: {
      course: { select: { id: true, name: true } },
      _count: { select: { questions: true } },
    },
  });
});

/* ------------------------------------------------------------------------- */
/* Detail queries                                                            */
/* ------------------------------------------------------------------------- */

const detailInclude = {
  course: {
    select: {
      id: true,
      name: true,
      tutor: { select: { id: true, fullName: true, email: true } },
    },
  },
  questions: {
    // Self-relation: parent + subQuestions arrive flat. Caller hydrates
    // the tree if needed. Order is the canonical sort key.
    include: { subQuestions: true, parent: true, UploadedFile: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.TestInclude;

export type TestDetail = NonNullable<
  Awaited<ReturnType<typeof getTestDetailById>>
>;

/**
 * Full test by ID — questions, sub-questions, course/tutor summary.
 * Returns null if not found (callers should `notFound()` from there).
 */
export const getTestDetailById = cache(async (id: string) => {
  return prisma.test.findUnique({
    where: { id },
    include: detailInclude,
  });
});

/* ------------------------------------------------------------------------- */
/* Submission queries                                                        */
/* ------------------------------------------------------------------------- */

const submissionInclude = {
  uploadedFiles: true,
  grade: true,
  questionGrades: true,
} satisfies Prisma.TestSubmissionInclude;

export type TestSubmissionDetail = NonNullable<
  Awaited<ReturnType<typeof getTestSubmissionByStudentAndTest>>
>;

/**
 * Returns the (one) submission row for a student against a test, or null.
 * Tests can be retaken in legacy data; we always return the latest by
 * `submittedAt` (falling back to `startedAt` for in-progress sessions).
 */
export const getTestSubmissionByStudentAndTest = cache(
  async (studentId: string, testId: string) => {
    return prisma.testSubmission.findFirst({
      where: { studentId, testId },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      include: submissionInclude,
    });
  },
);

/**
 * All submissions for a test — used by the tutor grading overview.
 * Includes the student so the row can render a name + avatar without an
 * additional fetch.
 */
export const listSubmissionsForTest = cache(async (testId: string) => {
  return prisma.testSubmission.findMany({
    where: { testId },
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    include: {
      ...submissionInclude,
      student: {
        select: { id: true, fullName: true, email: true, imageUrl: true },
      },
    },
  });
});

/**
 * Latest submission per (testId, studentId) for a student inside one course.
 * Used by the student "My grades" rollup so progress + scores show next to
 * each test in a course.
 */
export const listSubmissionsForStudentInCourse = cache(
  async (studentId: string, courseId: string) => {
    return prisma.testSubmission.findMany({
      where: { studentId, test: { courseId } },
      orderBy: { submittedAt: "desc" },
      include: submissionInclude,
    });
  },
);

/* ------------------------------------------------------------------------- */
/* Ownership / access helpers                                                */
/* ------------------------------------------------------------------------- */

/**
 * Does the test belong to a course owned by this tutor?
 * Used by update/delete/grade actions before mutating.
 */
export const testBelongsToTutor = cache(
  async (testId: string, tutorId: string) => {
    const t = await prisma.test.findUnique({
      where: { id: testId },
      select: { course: { select: { tutorId: true } } },
    });
    return t?.course.tutorId === tutorId;
  },
);

/**
 * Is the student enrolled in the course this test belongs to?
 * Gates entry into the test-taking page — students shouldn't be able to
 * deep-link into a test for a course they're not enrolled in.
 */
export const studentCanAccessTest = cache(
  async (testId: string, studentId: string) => {
    const t = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        isActive: true,
        course: { select: { students: { where: { id: studentId } } } },
      },
    });
    if (!t) return false;
    if (!t.isActive) return false;
    return t.course.students.length > 0;
  },
);
