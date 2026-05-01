/**
 * /dashboard/tests/review/[id] — student's review of a submitted test.
 *
 * Server Component. Pulls the test detail + the student's latest submission
 * + per-question grades (if any). Read-only — no mutations on this surface.
 *
 * `[id]` is the TEST id, not the submission id. The student's latest
 * submission is the canonical source of truth (one student → at most one
 * graded row per test in current data).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, GraduationCap, Hourglass } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
} from "@/features/assessments/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const metadata = { title: "Test review" };

export default async function TestReviewPage({ params }: PageProps) {
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

  const [test, submission] = await Promise.all([
    getTestDetailById(testId),
    getTestSubmissionByStudentAndTest(student.id, testId),
  ]);

  if (!test) notFound();
  if (!submission) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/courses/${test.courseId}`}>
            <ArrowLeft className="size-4" /> Back to course
          </Link>
        </Button>
        <Card className="mt-6 p-12 text-center">
          <h1 className="font-display text-2xl text-foreground">
            No submission yet
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You haven&apos;t started this test yet. Open it from your tests
            list to begin.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href={`/dashboard/tests/${test.id}`}>Open test</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Index per-question grades by questionId for fast lookup as we render.
  const qgByQ = new Map(
    submission.questionGrades.map((qg) => [qg.questionId, qg]),
  );

  // Pull just the top-level questions; sub-questions are walked recursively
  // inside the renderer below.
  const topQuestions = test.questions
    .filter((q) => q.parentId === null)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

  const status = submission.status;
  const graded = status === "GRADED";
  const grade = submission.grade;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/dashboard/courses/${test.courseId}`}>
          <ArrowLeft className="size-4" /> Back to course
        </Link>
      </Button>

      <header className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {test.course.name} · with {test.course.tutor.fullName}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {test.title}
          </h1>
          <Badge
            variant={
              graded ? "brand" : status === "SUBMITTED" ? "soft" : "secondary"
            }
          >
            {graded
              ? "Graded"
              : status === "SUBMITTED"
                ? "Awaiting grade"
                : status}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <Hourglass className="size-4" />
            Submitted{" "}
            {submission.submittedAt
              ? dateFmt.format(submission.submittedAt)
              : "—"}
          </span>
          {test.timeLimit != null && (
            <span className="inline-flex items-center gap-1">
              <Hourglass className="size-4" />
              {test.timeLimit} min limit
            </span>
          )}
        </div>
      </header>

      {graded && grade && (
        <Card className="bg-brand-terracotta/8 border-brand-terracotta/30 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-brand-terracotta/15 text-brand-terracotta flex size-12 items-center justify-center rounded-md">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <p className="font-display text-3xl tabular-nums text-foreground">
                {grade.score}
                <span className="text-muted-foreground"> / {grade.outOf}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {grade.outOf > 0
                  ? `${Math.round((grade.score / grade.outOf) * 100)}% overall`
                  : ""}
              </p>
            </div>
          </div>
          {submission.feedback && (
            <p className="text-muted-foreground max-w-md text-sm italic">
              &ldquo;{submission.feedback}&rdquo;
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Questions
          </h2>
          <span className="text-muted-foreground text-xs">
            {topQuestions.length}{" "}
            {topQuestions.length === 1 ? "question" : "questions"}
          </span>
        </div>
        <Separator />
        <ol className="divide-border divide-y">
          {topQuestions.map((q, idx) => {
            const qg = qgByQ.get(q.id);
            return (
              <li key={q.id} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">
                      Question {idx + 1} · {q.points} pts
                    </p>
                    <p className="text-foreground mt-1 whitespace-pre-wrap text-sm font-medium">
                      {q.question}
                    </p>
                  </div>
                  {qg && (
                    <div className="text-right shrink-0">
                      <p className="font-display tabular-nums text-foreground text-sm">
                        {qg.score}
                        <span className="text-muted-foreground">
                          {" "}
                          / {qg.outOf}
                        </span>
                      </p>
                      {qg.score === qg.outOf && (
                        <CheckCircle2 className="text-brand-terracotta ml-auto mt-0.5 size-4" />
                      )}
                    </div>
                  )}
                </div>
                {qg?.feedback && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm italic text-foreground">
                    {qg.feedback}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
