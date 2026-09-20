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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  getTestDetailById,
  testBelongsToTutor,
} from "@/features/assessments/queries";
import { TestRunner } from "@/features/assessments/components/test-runner";
import { buildRunnerTree } from "@/features/assessments/lib/question-tree";
import { seedAnswersFromKeys } from "@/features/assessments/lib/answer-key";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Preview test" };

export default async function PreviewTestPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const owns = await testBelongsToTutor(testId, tutor.id);
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this test.
      </div>
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
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-14 flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/tutor-tests">
                <ArrowLeft className="size-4" /> Back to tests
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {keyed} of {answerable} answered
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/tutor-tests/${test.id}/edit`}>
                  <Pencil className="size-4" /> Edit test
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <TestRunner
          mode="preview"
          testId={test.id}
          title={test.title}
          questions={questions}
          initialAnswers={initialAnswers}
          timeLimit={test.timeLimit}
          // No attempt exists, so anchor the countdown at page load. It's
          // there to show the tutor how much time students get; it never
          // submits anything.
          startedAt={new Date()}
        />
      </div>
    </div>
  );
}
