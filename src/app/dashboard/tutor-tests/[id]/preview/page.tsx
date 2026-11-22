/**
 * /dashboard/tutor-tests/[id]/preview — the tutor sits their own test.
 *
 * Renders the real student <TestRunner> in "preview" mode against the same
 * question tree the student page builds, so the tutor is checking the
 * actual thing rather than an approximation: same markdown and MathJax
 * pipeline, same image and attachment rendering, same inputs for all
 * twelve question types, same sub-question nesting.
 *
 * Whatever the tutor answers is saved as the test's ANSWER KEY — the memo
 * students are marked against — not as an attempt. Questions already
 * carrying a key open pre-filled with it, so the preview doubles as a way
 * to review and correct the memo.
 *
 * Server Component, tutor-only, ownership-gated.
 */

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PageMessage } from "@/components/shell/page-frame";
import { TestFrame, testRoutes } from "@/features/assessments/components/test-frame";

import {
  getTestDetailById,
  testBelongsToTutor,
} from "@/features/assessments/queries";
import { TestRunner } from "@/features/assessments/components/test-runner";
import { buildRunnerTree } from "@/features/assessments/lib/question-tree";
import { seedAnswersFromKeys } from "@/features/assessments/lib/answer-key";
import { getCourseScope } from "@/features/courses/course-access";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Preview test" };

export default async function PreviewTestPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const scope = await getCourseScope(session.user.id);

  const owns = await testBelongsToTutor(testId, scope);
  if (!owns) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: testRoutes.list }, { label: "Test" }]}>
        You don&apos;t own this test.
      </PageMessage>
    );
  }

  const test = await getTestDetailById(testId);
  if (!test) notFound();

  const questions = buildRunnerTree(test.questions);

  // Pre-fill from whatever key each question already carries, so the tutor
  // sees the current memo instead of an empty paper.
  const initialAnswers = seedAnswersFromKeys(
    test.questions.map((q) => ({
      id: q.id,
      type: q.type,
      options: q.options,
      matchPairs: q.matchPairs,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount,
      answer: q.answer,
    })),
  );

  const keyed = Object.keys(initialAnswers).length;
  const answerable = test.questions.filter((q) => q.type !== "NONE").length;

  return (
    <TestFrame
      test={test}
      page="Preview"
      actions={
        <span className="text-muted-foreground text-xs tabular-nums">
          {keyed} of {answerable} answered
        </span>
      }
    >
      <TestRunner
        mode="preview"
        testId={test.id}
        title={test.title}
        questions={questions}
        initialAnswers={initialAnswers}
        timeLimit={test.timeLimit}
        labelScheme={test.labelScheme}
        // No attempt exists, so anchor the countdown at page load. It's
        // there to show the tutor how much time students get; it never
        // submits anything.
        startedAt={new Date()}
      />
    </TestFrame>
  );
}
