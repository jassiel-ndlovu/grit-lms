/**
 * /dashboard/tests/[id] - student test runner. The revamp shell shows it
 * without the sidebar (nav-config isFocusRoute); "Save and exit" is the
 * way out.
 *
 * Server Component shell that resolves the student's submission state and
 * either loads the in-progress runner or routes to the pre-test landing
 * (no submission yet) or the review page (already submitted/graded).
 *
 * Tree handling lives in features/assessments/lib/question-tree.ts, shared
 * with the tutor preview so both render an identical structure.
 */

import { PageFrame, PageMessage } from "@/components/shell/page-frame";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRevampUi } from "@/lib/ui-flags";
import { BELOW_RUNNER_STRIP_TOP_CLASS } from "@/lib/ui-layout";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
  studentCanAccessTest,
} from "@/features/assessments/queries";
import { TestRunner } from "@/features/assessments/components/test-runner";
import { buildRunnerTree } from "@/features/assessments/lib/question-tree";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Test" };

export default async function TestRunnerPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!student) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: "/dashboard/tests" }, { label: "Test" }]}>
        No student profile found for this account.
      </PageMessage>
    );
  }

  const canAccess = await studentCanAccessTest(testId, student.id);
  if (!canAccess) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: "/dashboard/tests" }, { label: "Test" }]}>
        This test isn&apos;t available right now.
      </PageMessage>
    );
  }

  const [test, submission] = await Promise.all([
    getTestDetailById(testId),
    getTestSubmissionByStudentAndTest(student.id, testId),
  ]);

  if (!test) notFound();

  if (!submission) {
    redirect(`/dashboard/tests/pre-test/${testId}`);
  }
  if (submission.status === "SUBMITTED" || submission.status === "GRADED") {
    redirect(`/dashboard/tests/review/${testId}`);
  }

  const treeQuestions = buildRunnerTree(test.questions);

  // The legacy answers JSON is keyed by questionId. Coerce to a record
  // (handles the case where it's stored as null or {}).
  const initialAnswers: Record<string, unknown> =
    submission.answers &&
    typeof submission.answers === "object" &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};

  // The revamp shell shows this route alone (isFocusRoute): the frame's
  // runner strip is at the top and the runner's own bar sticks under it.
  // The legacy shell keeps its own sticky header (h-14, lg:h-20) above it.
  const stickyTop = isRevampUi() ? BELOW_RUNNER_STRIP_TOP_CLASS : "top-14 lg:top-20";

  return (
    <PageFrame
      type="runner"
      breadcrumb={[{ label: test.course?.name ?? "Course", href: `/dashboard/courses/${test.courseId}` }, { label: test.title }]}
    >
      <TestRunner
        testId={test.id}
        submissionId={submission.id}
        title={test.title}
        questions={treeQuestions}
        initialAnswers={initialAnswers}
        timeLimit={test.timeLimit}
        labelScheme={test.labelScheme}
        startedAt={submission.startedAt}
        dueDate={test.dueDate}
        exitHref={`/dashboard/courses/${test.courseId}`}
        stickyTop={stickyTop}
        extraTimePercent={submission.extraTimePercent}
        noTimeLimit={submission.noTimeLimit}
      />
    </PageFrame>
  );
}
