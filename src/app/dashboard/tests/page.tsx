/**
 * /dashboard/tests — student's catalogue of tests across enrolled courses.
 *
 * Server Component. Pulls active tests for the calling student and the
 * student's submission for each. Tabs compartmentalise into upcoming,
 * missed, submitted, and graded so students can jump straight to what
 * they need to do vs. what they've already done.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getTestSubmissionByStudentAndTest,
  listActiveTestsForStudent,
} from "@/features/assessments/queries";
import { TestCard } from "@/features/assessments/components/test-card";
import { TestGrid } from "@/features/assessments/components/test-grid";
import { TestsTabs } from "@/features/assessments/components/tests-tabs";
import {
  bucketCounts,
  filterByBucket,
  type FilterBucket,
} from "@/features/assessments/lib/filters";
import { testMarksReleased } from "@/features/grades/lib/release";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import HeaderTests from "@/components/illustrations/generated/header-tests";
import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";

export const metadata = { title: "Tests & Quizzes" };

type SubmissionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "GRADED"
  | "LATE"
  | "NOT_SUBMITTED";

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
      <PageMessage breadcrumb={[{ label: "Tests" }]}>
        This page is for students, and this account isn&apos;t set up as one. If you&apos;re a student, ask your tutor or school to check it.
      </PageMessage>
    );
  }

  const tests = await listActiveTestsForStudent(student.id);
  const submissions = await Promise.all(
    tests.map((t) => getTestSubmissionByStudentAndTest(student.id, t.id)),
  );

  const rows = tests.map((test, i) => ({
    test,
    submission: submissions[i],
    dueDate: test.dueDate,
    status: submissions[i]?.status ?? "NOT_STARTED",
  }));

  const counts = bucketCounts(rows);

  function renderBucket(b: FilterBucket) {
    const filtered = filterByBucket(rows, b).sort(
      (a, b) => a.test.dueDate.getTime() - b.test.dueDate.getTime(),
    );
    return (
      <TestGrid
        isEmpty={filtered.length === 0}
        empty={
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-tests" />}
            title={
              b === "upcoming"
                ? "No tests to take right now"
                : b === "missed"
                  ? "You haven't missed any tests"
                  : b === "submitted"
                    ? "Nothing waiting to be marked"
                    : b === "graded"
                      ? "No marked tests yet"
                      : "No tests yet"
            }
            description={
              b === "upcoming"
                ? "When a tutor sets a test on one of your courses, it shows here with its due date."
                : b === "submitted"
                  ? "Tests you hand in show here until your tutor marks them."
                  : b === "graded"
                    ? "Your marks and your tutor's comments show here after a test is marked."
                    : b === "all"
                      ? "Tests your tutors set show here."
                      : undefined
            }
          />
        }
      >
        {filtered.map(({ test, submission }) => (
          <TestCard
            key={test.id}
            test={test}
            submission={
              submission
                ? {
                    status: submission.status as SubmissionStatus,
                    // Auto-marked but not released: no score on the card.
                    score: testMarksReleased(submission.status, test.releaseAutoMarksToStudent) ? submission.score : null,
                    grade: submission.grade && testMarksReleased(submission.status, test.releaseAutoMarksToStudent)
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
                : `/dashboard/tests/pre-test/${test.id}`
            }
          />
        ))}
      </TestGrid>
    );
  }

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Tests" }]}>
      <PageTitle
        eyebrow="Assessments"
        title="Tests"
        description="Tests and quizzes your tutors have set, with the ones you need to do first at the top."
        illustration={<HeaderTests />}
      />

      <TestsTabs
        counts={counts}
        panels={{
          all: renderBucket("all"),
          upcoming: renderBucket("upcoming"),
          missed: renderBucket("missed"),
          submitted: renderBucket("submitted"),
          graded: renderBucket("graded"),
        }}
      />
    </PageFrame>
  );
}
