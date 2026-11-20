import "server-only";

/**
 * Data for the parent's per-child view and the summary on each parent-home
 * card: courses per workspace with lesson progress, released marks, and
 * tests and assignments due in the next two weeks.
 *
 * Callers must check the guardianship first (`canIn(viewer, "grades.view",
 * { childUserId })`); this module trusts the id it is given. It reuses the
 * student queries, keyed by the child's Student profile.
 */

import { prisma } from "@/lib/db";
import { listCoursesByStudentId } from "@/features/courses/queries";
import { tutorOf } from "@/features/courses/lib/tenancy-where";
import { listCompletionsForStudentInCourse, listLessonsByCourseId } from "@/features/lessons/queries";
import { getTestSubmissionByStudentAndTest, listActiveTestsForStudent } from "@/features/assessments/queries";
import { getEntryByStudentAndSubmission, listActiveSubmissionsForStudent } from "@/features/assignments/queries";
import { listGradesWithReleaseForStudent } from "@/features/grades/queries";

import {
  dueSoon,
  groupByWorkspace,
  isReleased,
  lessonProgress,
  overallProgress,
  percentOf,
  type Progress,
  type UpcomingItem,
} from "./lib/child-overview";

export type ChildCourse = {
  id: string;
  name: string;
  workspaceId: string | null;
  tutorName: string | null;
  progress: Progress;
};

export type ChildMark = {
  id: string;
  title: string;
  courseName: string;
  score: number;
  outOf: number;
  percent: number;
  date: Date;
};

export type ChildOverview = {
  /** False when the child has no Student profile yet (nothing to show). */
  hasProfile: boolean;
  workspaces: Array<{ id: string | null; name: string; courses: ChildCourse[] }>;
  progress: Progress;
  marks: ChildMark[];
  upcoming: UpcomingItem[];
};

const RECENT_MARKS = 6;

async function studentIdFor(childUserId: string): Promise<string | null> {
  const s = await prisma.student.findUnique({ where: { userId: childUserId }, select: { id: true } });
  return s?.id ?? null;
}

export async function getChildOverview(
  child: { userId: string; workspaces: ReadonlyArray<{ id: string; name: string }> },
  now: Date,
): Promise<ChildOverview> {
  const studentId = await studentIdFor(child.userId);
  if (!studentId) {
    return { hasProfile: false, workspaces: [], progress: overallProgress([]), marks: [], upcoming: [] };
  }

  const [courses, grades, tests, assignments] = await Promise.all([
    listCoursesByStudentId(studentId),
    listGradesWithReleaseForStudent(studentId),
    listActiveTestsForStudent(studentId),
    listActiveSubmissionsForStudent(studentId),
  ]);

  const childCourses: ChildCourse[] = await Promise.all(
    courses.map(async (c) => {
      const [lessons, completions] = await Promise.all([
        listLessonsByCourseId(c.id),
        listCompletionsForStudentInCourse(studentId, c.id),
      ]);
      return {
        id: c.id,
        name: c.name,
        workspaceId: c.workspaceId,
        tutorName: tutorOf(c)?.fullName ?? null,
        progress: lessonProgress(lessons, completions),
      };
    }),
  );

  const marks: ChildMark[] = grades
    .filter(isReleased)
    .slice(0, RECENT_MARKS)
    .map((g) => ({
      id: g.id,
      title: g.testSubmission?.test.title ?? g.submissionEntry?.submission.title ?? g.title,
      courseName: g.course.name,
      score: g.score,
      outOf: g.outOf,
      percent: percentOf(g.score, g.outOf),
      date: g.updatedAt,
    }));

  const soonTests = dueSoon(tests, now);
  const soonAssignments = dueSoon(assignments, now);
  const [testSubs, entries] = await Promise.all([
    Promise.all(soonTests.map((t) => getTestSubmissionByStudentAndTest(studentId, t.id))),
    Promise.all(soonAssignments.map((a) => getEntryByStudentAndSubmission(studentId, a.id))),
  ]);
  const upcoming = dueSoon<UpcomingItem>(
    [
      ...soonTests.map((t, i) => ({
        kind: "test" as const,
        id: t.id,
        title: t.title,
        courseName: t.course.name,
        dueDate: t.dueDate,
        status: testSubs[i]?.status ?? null,
      })),
      ...soonAssignments.map((a, i) => ({
        kind: "assignment" as const,
        id: a.id,
        title: a.title,
        courseName: a.course.name,
        dueDate: a.dueDate,
        status: entries[i]?.status ?? null,
      })),
    ],
    now,
  );

  return {
    hasProfile: true,
    workspaces: groupByWorkspace(childCourses, child.workspaces),
    progress: overallProgress(childCourses.map((c) => c.progress)),
    marks,
    upcoming,
  };
}

/** The short summary on a parent-home card. */
export type ChildSummary = { progress: Progress; latestMark: ChildMark | null; dueSoon: number };

export async function getChildSummary(
  child: { userId: string; workspaces: ReadonlyArray<{ id: string; name: string }> },
  now: Date,
): Promise<ChildSummary> {
  const o = await getChildOverview(child, now);
  return { progress: o.progress, latestMark: o.marks[0] ?? null, dueSoon: o.upcoming.length };
}
