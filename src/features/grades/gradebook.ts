/**
 * Gradebook data access — server-only.
 *
 * Pulls everything one course's gradebook needs in a handful of queries and
 * shapes it for features/grades/lib/weighting.ts, which does the maths.
 *
 * Assessment ids are namespaced (`test:<id>` / `assignment:<id>`) because
 * tests and assignments live in different tables but share one weighting
 * space. The prefix is also what the weights form posts back.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

import type {
  AssessmentKind,
  StudentResult,
  WeightedAssessment,
} from "./lib/weighting";

export function assessmentKey(kind: AssessmentKind, id: string): string {
  return `${kind}:${id}`;
}

/** Split a namespaced key back into its parts, or null if malformed. */
export function parseAssessmentKey(
  key: string,
): { kind: AssessmentKind; id: string } | null {
  const idx = key.indexOf(":");
  if (idx === -1) return null;
  const kind = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if (!id) return null;
  if (kind !== "test" && kind !== "assignment") return null;
  return { kind, id };
}

export interface GradebookStudent {
  id: string;
  fullName: string;
  email: string;
  imageUrl: string | null;
}

export interface CourseGradebook {
  course: { id: string; name: string };
  students: GradebookStudent[];
  assessments: WeightedAssessment[];
  /** Graded results keyed by student id, in the same shape weighting wants. */
  resultsByStudent: Map<string, StudentResult[]>;
}

/**
 * Everything the class view needs. Ungraded assessments still appear — the
 * tutor has to be able to weight an assessment before anyone sits it.
 */
export const getCourseGradebook = cache(
  async (courseId: string): Promise<CourseGradebook | null> => {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        students: {
          select: { id: true, fullName: true, email: true, imageUrl: true },
          orderBy: { fullName: "asc" },
        },
      },
    });
    if (!course) return null;

    const [tests, submissions, grades] = await Promise.all([
      prisma.test.findMany({
        where: { courseId },
        select: {
          id: true,
          title: true,
          totalPoints: true,
          weight: true,
          dueDate: true,
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.submission.findMany({
        where: { courseId },
        select: {
          id: true,
          title: true,
          totalPoints: true,
          weight: true,
          dueDate: true,
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.grade.findMany({
        where: { courseId },
        select: {
          studentId: true,
          score: true,
          outOf: true,
          testSubmission: { select: { testId: true } },
          submissionEntry: { select: { submissionId: true } },
        },
      }),
    ]);

    const assessments: WeightedAssessment[] = [
      ...tests.map((t) => ({
        id: assessmentKey("test", t.id),
        kind: "test" as const,
        title: t.title,
        totalPoints: t.totalPoints,
        weight: t.weight,
        dueDate: t.dueDate,
      })),
      ...submissions.map((s) => ({
        id: assessmentKey("assignment", s.id),
        kind: "assignment" as const,
        title: s.title,
        totalPoints: s.totalPoints,
        weight: s.weight,
        dueDate: s.dueDate,
      })),
    ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const resultsByStudent = new Map<string, StudentResult[]>();
    for (const student of course.students) resultsByStudent.set(student.id, []);

    for (const g of grades) {
      // A Grade row points at exactly one of the two; anything else is a
      // data problem and is skipped rather than guessed at.
      const key = g.testSubmission
        ? assessmentKey("test", g.testSubmission.testId)
        : g.submissionEntry
          ? assessmentKey("assignment", g.submissionEntry.submissionId)
          : null;
      if (!key) continue;

      const bucket = resultsByStudent.get(g.studentId);
      // Grades can outlive an un-enrolment; only currently enrolled
      // students have a bucket, and the rest are intentionally dropped.
      if (!bucket) continue;

      bucket.push({ assessmentId: key, score: g.score, outOf: g.outOf });
    }

    return {
      course: { id: course.id, name: course.name },
      students: course.students,
      assessments,
      resultsByStudent,
    };
  },
);

/** Courses owned by a tutor, with enough for the gradebook index cards. */
export const listGradebookCoursesForTutor = cache(async (tutorId: string) => {
  return prisma.course.findMany({
    where: { tutorId },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      _count: { select: { students: true, tests: true, submissions: true } },
    },
    orderBy: { name: "asc" },
  });
});

/** Ownership gate for the gradebook pages and the weights action. */
export const courseBelongsToTutor = cache(
  async (courseId: string, tutorId: string) => {
    const c = await prisma.course.findUnique({
      where: { id: courseId },
      select: { tutorId: true },
    });
    return c?.tutorId === tutorId;
  },
);
