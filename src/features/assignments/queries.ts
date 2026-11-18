/**
 * Submission (assignment) queries — server-only data access.
 *
 * Submissions are open-ended assignments (uploaded files / written work),
 * distinct from TestSubmissions which live under features/assessments.
 *
 * SubmissionEntry rows are 1:N off Submission (one per student attempt) —
 * the unique constraint on (submissionId, studentId) means most flows have
 * a single entry per pair; multi-attempt assignments increment
 * `attemptNumber`.
 */

import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/db";

const submissionListInclude = {
  course: { select: { id: true, name: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.SubmissionInclude;

export type SubmissionListItem = Awaited<
  ReturnType<typeof listSubmissionsByTutorId>
>[number];

/* ------------------------------------------------------------------------- */
/* Submission (assignment) lists                                              */
/* ------------------------------------------------------------------------- */

/**
 * Assignments owned by a tutor (across all their courses).
 */
export const listSubmissionsByTutorId = cache(async (tutorId: string) => {
  return prisma.submission.findMany({
    where: { course: { tutorId } },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    include: submissionListInclude,
  });
});

/**
 * Active assignments inside one course — student course detail tab.
 */
export const listActiveSubmissionsByCourseId = cache(async (courseId: string) => {
  return prisma.submission.findMany({
    where: { courseId, isActive: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: submissionListInclude,
  });
});

/**
 * Active assignments for every course a student is enrolled in.
 */
export const listActiveSubmissionsForStudent = cache(
  async (studentId: string) => {
    return prisma.submission.findMany({
      where: {
        isActive: true,
        course: { students: { some: { id: studentId } } },
      },
      orderBy: { dueDate: "asc" },
      include: submissionListInclude,
    });
  },
);

/* ------------------------------------------------------------------------- */
/* Submission (assignment) detail                                             */
/* ------------------------------------------------------------------------- */

const submissionDetailInclude = {
  course: {
    select: {
      id: true,
      name: true,
      tutor: { select: { id: true, fullName: true, email: true } },
    },
  },
} satisfies Prisma.SubmissionInclude;

export type SubmissionDetail = NonNullable<
  Awaited<ReturnType<typeof getSubmissionDetailById>>
>;

export const getSubmissionDetailById = cache(async (id: string) => {
  return prisma.submission.findUnique({
    where: { id },
    include: submissionDetailInclude,
  });
});

/* ------------------------------------------------------------------------- */
/* SubmissionEntry queries                                                    */
/* ------------------------------------------------------------------------- */

const entryInclude = {
  grade: true,
  questionGrades: true,
  student: {
    select: { id: true, fullName: true, email: true, imageUrl: true },
  },
  submission: { select: { id: true, title: true, courseId: true } },
} satisfies Prisma.SubmissionEntryInclude;

export type SubmissionEntryDetail = NonNullable<
  Awaited<ReturnType<typeof getEntryByStudentAndSubmission>>
>;

/**
 * The (one) entry for a (studentId, submissionId) pair, or null.
 * Latest by submittedAt — handles the rare multi-attempt case.
 */
export const getEntryByStudentAndSubmission = cache(
  async (studentId: string, submissionId: string) => {
    return prisma.submissionEntry.findFirst({
      where: { studentId, submissionId },
      orderBy: [{ submittedAt: "desc" }, { attemptNumber: "desc" }],
      include: entryInclude,
    });
  },
);

/**
 * All entries for a submission — tutor grading overview.
 */
export const listEntriesForSubmission = cache(async (submissionId: string) => {
  return prisma.submissionEntry.findMany({
    where: { submissionId },
    orderBy: [{ submittedAt: "desc" }, { attemptNumber: "desc" }],
    include: entryInclude,
  });
});

/**
 * All entries by a student inside one course — student course detail.
 */
export const listEntriesForStudentInCourse = cache(
  async (studentId: string, courseId: string) => {
    return prisma.submissionEntry.findMany({
      where: { studentId, submission: { courseId } },
      orderBy: { submittedAt: "desc" },
      include: entryInclude,
    });
  },
);

/* ------------------------------------------------------------------------- */
/* Ownership helpers                                                          */
/* ------------------------------------------------------------------------- */

export const submissionBelongsToTutor = cache(
  async (submissionId: string, tutorId: string) => {
    const s = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { course: { select: { tutorId: true } } },
    });
    return s?.course.tutorId === tutorId;
  },
);

export const studentCanAccessSubmission = cache(
  async (submissionId: string, studentId: string) => {
    const s = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        isActive: true,
        course: { select: { students: { where: { id: studentId } } } },
      },
    });
    if (!s) return false;
    if (!s.isActive) return false;
    return s.course.students.length > 0;
  },
);
