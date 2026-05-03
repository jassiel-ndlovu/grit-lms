/**
 * /dashboard/tests/[id] - student test runner.
 *
 * Server Component shell that resolves the student's submission state and
 * either loads the in-progress runner or routes to the pre-test landing
 * (no submission yet) or the review page (already submitted/graded).
 *
 * Tree handling: Prisma's `include: { subQuestions: true }` gives us the
 * full set of TestQuestions for the test as a flat array, but the parent
 * relation is one level deep on each row. We rebuild the tree on the
 * server (top-level questions get their direct children embedded; the
 * runner doesn't need to traverse deeper than the API normally serves).
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
  studentCanAccessTest,
  type TestDetail,
} from "@/features/assessments/queries";
import {
  TestRunner,
  type RunnerQuestion,
} from "@/features/assessments/components/test-runner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Test" };

/**
 * Build the runner-shaped tree from the flat questions array Prisma
 * returns. We only embed direct children for now (the schema's
 * `include: { subQuestions: true }` is one-deep); if multi-level nesting
 * lands in authoring later, expand the recursion here.
 */
function buildTree(all: TestDetail["questions"]): RunnerQuestion[] {
  const byId = new Map(all.map((q) => [q.id, q]));

  function toRunner(q: TestDetail["questions"][number]): RunnerQuestion {
    return {
      id: q.id,
      question: q.question,
      type: q.type,
      points: q.points,
      options: q.options,
      language: q.language,
      matchPairs: q.matchPairs,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount,
      parentId: q.parentId,
      order: q.order,
      subQuestions: [],
    };
  }

  // Group by parentId for fast lookup, sort each bucket.
  const byParent = new Map<string | null, TestDetail["questions"]>();
  for (const q of all) {
    const key = q.parentId ?? null;
    const list = byParent.get(key);
    if (list) list.push(q);
    else byParent.set(key, [q]);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  function build(parentId: string | null): RunnerQuestion[] {
    const direct = byParent.get(parentId) ?? [];
    return direct.map((q) => {
      const node = toRunner(q);
      node.subQuestions = build(q.id);
      return node;
    });
  }

  // Touch byId to silence the unused-var warning when build() doesn't need it.
  void byId;
  return build(null);
}

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
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const canAccess = await studentCanAccessTest(testId, student.id);
  if (!canAccess) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        This test isn&apos;t available right now.
      </div>
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

  const treeQuestions = buildTree(test.questions);

  // The legacy answers JSON is keyed by questionId. Coerce to a record
  // (handles the case where it's stored as null or {}).
  const initialAnswers: Record<string, unknown> =
    submission.answers &&
    typeof submission.answers === "object" &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/dashboard/courses/${test.courseId}`}>
                <ArrowLeft className="size-4" /> Back to course
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <TestRunner
          testId={test.id}
          submissionId={submission.id}
          title={test.title}
          questions={treeQuestions}
          initialAnswers={initialAnswers}
          timeLimit={test.timeLimit}
          startedAt={submission.startedAt}
        />
      </div>
    </div>
  );
}
