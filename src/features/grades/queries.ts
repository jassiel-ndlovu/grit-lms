/**
 * Grade queries — server-only data access.
 *
 * Grades are 1:1 with either a TestSubmission or a SubmissionEntry. We
 * never duplicate grading writes here — the canonical write path is
 *   - gradeTestSubmission   (features/assessments/actions.ts)
 *   - gradeSubmissionEntry  (features/submissions/actions.ts)
 * — both of which upsert the Grade row inside their transaction. This
 * file is read-only on purpose.
 */

import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";

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
 * All grades for one student, newest first. Used by the student "Grades"
 * page. Uses Prisma `include` to surface enough metadata that the row can
 * render a title + course name without cross-fetching.
 */
export const listGradesForStudent = cache(async (studentId: string) => {
  return prisma.grade.findMany({
    where: { studentId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: gradeInclude,
  });
});

/**
 * Grades for one student inside one course — the rollup shown on the
 * student course detail.
 */
export const listGradesForStudentInCourse = cache(
  async (studentId: string, courseId: string) => {
    return prisma.grade.findMany({
      where: { studentId, courseId },
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
