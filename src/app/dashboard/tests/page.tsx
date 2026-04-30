/**
 * /dashboard/tests — student's catalogue of tests across enrolled courses.
 *
 * Server Component. Pulls active tests for the calling student and the
 * student's submission for each (one round-trip per test for status). Tests
 * are grouped by status: ones needing action first (not started + in-progress),
 * then awaiting-grade, then graded.
 */

import { redirect } from "next/navigation";
import { Target } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getTestSubmissionByStudentAndTest,
  listActiveTestsForStudent,
} from "@/features/assessments/queries";
import { TestCard } from "@/features/assessments/components/test-card";
import { TestGrid } from "@/features/assessments/components/test-grid";

export const metadata = { title: "Tests & Quizzes" };

type SubmissionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "GRADED"
  | "LATE"
  | "NOT_SUBMITTED";

const STATUS_ORDER: Record<SubmissionStatus, number> = {
  IN_PROGRESS: 0,
  NOT_STARTED: 1,
  LATE: 2,
  NOT_SUBMITTED: 3,
  SUBMITTED: 4,
  GRADED: 5,
};

export default async function StudentTestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const tests = await listActiveTestsForStudent(student.id);

  // Resolve the student's submission for each test in parallel — these
  // queries are cache()'d so they de-dupe inside the same request.
  const submissions = await Promise.all(
    tests.map((t) => getTestSubmissionByStudentAndTest(student.id, t.id)),
  );

  const rows = tests.map((test, i) => ({ test, submission: submissions[i] }));
  rows.sort((a, b) => {
    const aStatus = (a.submission?.status as SubmissionStatus) ?? "NOT_STARTED";
    const bStatus = (b.submission?.status as SubmissionStatus) ?? "NOT_STARTED";
    const orderDiff = STATUS_ORDER[aStatus] - STATUS_ORDER[bStatus];
    if (orderDiff !== 0) return orderDiff;
    return a.test.dueDate.getTime() - b.test.dueDate.getTime();
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          Tests & quizzes
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Active assessments across your courses.
        </p>
      </header>

      <TestGrid
        isEmpty={rows.length === 0}
        empty={
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <Target className="text-muted-foreground mx-auto size-10" />
            <h3 className="font-display mt-3 text-lg text-foreground">
              No active assessments
            </h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
              Assessments your tutors publish will show up here.
            </p>
          </div>
        }
      >
        {rows.map(({ test, submission }) => (
          <TestCard
            key={test.id}
            test={test}
            submission={
              submission
                ? {
                    status: submission.status as SubmissionStatus,
                    score: submission.score,
                    grade: submission.grade
                      ? {
                          score: submission.grade.score,
                          outOf: submission.grade.outOf,
                        }
                      : null,
                  }
                : null
            }
            href={
              submission?.status === "GRADED" ||
              submission?.status === "SUBMITTED"
                ? `/dashboard/tests/review/${test.id}`
                : `/dashboard/tests/${test.id}`
            }
          />
        ))}
      </TestGrid>
    </div>
  );
}
