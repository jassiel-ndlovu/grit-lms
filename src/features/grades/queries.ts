/**
 * Grade queries — server-only data access.
 *
 * Grades are 1:1 with either a TestSubmission or a SubmissionEntry. We
 * never duplicate grading writes here — the canonical write path is
 *   - gradeTestSubmission   (features/assessments/actions.ts)
 *   - gradeSubmissionEntry  (features/assignments/actions.ts)
 * — both of which upsert the Grade row inside their transaction. This
 * file is read-only on purpose.
 */

import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";
import { ownerTutor } from "@/features/courses/lib/tenancy-where";
import { RELEASED_GRADE } from "@/features/grades/lib/release";

const gradeInclude = {
  course: { select: { id: true, name: true } },
  testSubmission: {
    select: {
      id: true,
      submittedAt: true,
      test: { select: { id: true, title: true } },
    },
  },
  submissionEntry: {
    select: {
      id: true,
      submittedAt: true,
      submission: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.GradeInclude;

export type GradeListItem = Awaited<
  ReturnType<typeof listGradesForStudent>
>[number];

/**
 * One student's released grades, newest first. Used by the student "Grades"
 * page and home: a mark the tutor hasn't released stays out. Uses Prisma `include` to surface enough metadata that the row can
 * render a title + course name without cross-fetching.
 */
export const listGradesForStudent = cache(async (studentId: string) => {
  return prisma.grade.findMany({
    where: { studentId, ...RELEASED_GRADE },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: gradeInclude,
  });
});

/**
 * Released grades for one student inside one course — the rollup shown on the
 * student course detail.
 */
export const listGradesForStudentInCourse = cache(
  async (studentId: string, courseId: string) => {
    return prisma.grade.findMany({
      where: { studentId, courseId, ...RELEASED_GRADE },
      orderBy: { updatedAt: "desc" },
      include: gradeInclude,
    });
  },
);

/**
 * All grades inside a course — tutor view (gradebook). Includes the student
 * so the row renders a name + avatar.
 */
export const listGradesForCourse = cache(async (courseId: string) => {
  return prisma.grade.findMany({
    where: { courseId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      ...gradeInclude,
      student: {
        select: { id: true, fullName: true, email: true, imageUrl: true },
      },
    },
  });
});

/**
 * Grade row for a specific test submission, or null. Used by the student
 * test-review page to render score + feedback when graded.
 */
export const getGradeForTestSubmission = cache(
  async (testSubmissionId: string) => {
    return prisma.grade.findUnique({
      where: { testSubmissionId },
      include: gradeInclude,
    });
  },
);

/**
 * Grade row for a specific submission entry (assignment), or null.
 */
export const getGradeForSubmissionEntry = cache(
  async (submissionEntryId: string) => {
    return prisma.grade.findUnique({
      where: { submissionEntryId },
      include: gradeInclude,
    });
  },
);

/**
 * QuestionGrade rows for a test submission — used by the review page to
 * surface per-question feedback.
 */
export const listQuestionGradesForTestSubmission = cache(
  async (testSubmissionId: string) => {
    return prisma.questionGrade.findMany({
      where: { testSubmissionId },
      orderBy: { createdAt: "asc" },
    });
  },
);

/* ------------------------------------------------------------------------- */
/* Detail query for the canonical grade page                                  */
/* ------------------------------------------------------------------------- */

const detailInclude = {
  course: {
    select: {
      id: true,
      name: true,
      ownerMembership: ownerTutor,
    },
  },
  testSubmission: {
    include: {
      uploadedFiles: true,
      questionGrades: true,
      test: {
        include: {
          questions: {
            include: { subQuestions: true, parent: true },
          },
        },
      },
    },
  },
  submissionEntry: {
    include: {
      questionGrades: true,
      submission: {
        select: {
          id: true,
          title: true,
          description: true,
          courseId: true,
          totalPoints: true,
          fileType: true,
          maxAttempts: true,
        },
      },
    },
  },
} satisfies Prisma.GradeInclude;

export type GradeDetail = NonNullable<
  Awaited<ReturnType<typeof getGradeWithDetails>>
>;

/**
 * Full grade row with the linked test submission (answers + question tree
 * + per-question grades) or submission entry (files + per-question grades),
 * plus the course/tutor summary the page header needs.
 *
 * Returns null if the grade doesn't exist, isn't this student's, or isn't
 * released yet; the page should `notFound()`. Role gating is the page's.
 */
export const getGradeWithDetails = cache(async (id: string, studentId: string) => {
  return prisma.grade.findFirst({
    where: { id, studentId, ...RELEASED_GRADE },
    include: detailInclude,
  });
});

/**
 * Grades for one student with the fields that say whether each mark is
 * released (submission status, the test's release-auto-marks setting).
 * The parent's child view filters with `isReleased`
 * (features/grades/lib/release.ts), so a parent never sees a mark
 * the student cannot.
 */
export const listGradesWithReleaseForStudent = cache(async (studentId: string) => {
  return prisma.grade.findMany({
    where: { studentId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      score: true,
      outOf: true,
      updatedAt: true,
      course: { select: { id: true, name: true } },
      testSubmission: {
        select: { status: true, test: { select: { title: true, releaseAutoMarksToStudent: true } } },
      },
      submissionEntry: { select: { status: true, submission: { select: { title: true } } } },
    },
  });
});
