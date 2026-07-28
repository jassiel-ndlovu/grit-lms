/**
 * /dashboard/tutor-tests/submissions/[testId]/[studentId]
 *
 * Tutor's per-question grading view for one student's test submission.
 * Server Component shell that:
 *   - Verifies the calling tutor owns the test
 *   - Fetches the test's question tree + the student's TestSubmission
 *     (with answers, existing QuestionGrades, existing Grade)
 *   - Renders <GradingForm> which handles all mutation
 *
 * Replaces the legacy /dashboard/tutor-tests/submissions/[id]/(student)/
 * [studentId] page (which was a heavy client component reading directly
 * from TestContext / QuestionGradeContext).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, GraduationCap, Mail, User } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
  testBelongsToTutor,
  type TestDetail,
} from "@/features/assessments/queries";
import {
  GradingForm,
  type GradingQuestion,
} from "@/features/assessments/components/grading-form";

interface PageProps {
  params: Promise<{ testId: string; studentId: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const metadata = { title: "Grade submission" };

/**
 * Build the tree the grading form expects. Prisma's `include:
 * { subQuestions: true }` gives us one-deep nesting from the top-level
 * question; if the schema ever grows deeper we can recurse further.
 */
function buildTree(all: TestDetail["questions"]): GradingQuestion[] {
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

  function build(parentId: string | null): GradingQuestion[] {
    const direct = byParent.get(parentId) ?? [];
    return direct.map((q) => ({
      id: q.id,
      parentId: q.parentId,
      order: q.order,
      type: q.type,
      question: q.question,
      points: q.points,
      options: q.options,
      blankCount: q.blankCount,
      reorderItems: q.reorderItems,
      matchPairs: q.matchPairs,
      subQuestions: build(q.id),
    }));
  }
  return build(null);
}

export default async function GradeStudentSubmissionPage({ params }: PageProps) {
  const { testId, studentId } = await params;

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

  const [test, student, submission] = await Promise.all([
    getTestDetailById(testId),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, email: true, imageUrl: true },
    }),
    getTestSubmissionByStudentAndTest(studentId, testId),
  ]);
  if (!test) notFound();
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        Student not found.
      </div>
    );
  }
  if (!submission) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/tutor-tests/${test.id}/submissions`}>
            <ArrowLeft className="size-4" /> Back to submissions
          </Link>
        </Button>
        <Card className="mt-6 p-12 text-center">
          <h1 className="font-display text-2xl text-foreground">
            No submission
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {student.fullName} hasn&apos;t started this test yet.
          </p>
        </Card>
      </div>
    );
  }

  const questions = buildTree(test.questions);

  // Coerce answers JSON into a record.
  const answers: Record<string, unknown> =
    submission.answers &&
    typeof submission.answers === "object" &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};

  const existingQuestionGrades = submission.questionGrades.map((qg) => ({
    questionId: qg.questionId,
    score: qg.score,
    outOf: qg.outOf,
    feedback: qg.feedback,
  }));

  const existingGrade = submission.grade
    ? {
        score: submission.grade.score,
        outOf: submission.grade.outOf,
        finalComments: submission.grade.finalComments,
      }
    : null;

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/dashboard/tutor-tests/${test.id}/submissions`}>
                <ArrowLeft className="size-4" /> Back to submissions
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <header className="space-y-3">
          <p className="text-muted-foreground text-xs">
            {test.course.name} · {test.title}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
              Grade {student.fullName}
            </h1>
            <Badge
              variant={
                submission.status === "GRADED"
                  ? "brand"
                  : submission.status === "SUBMITTED"
                    ? "soft"
                    : "secondary"
              }
            >
              {submission.status === "GRADED"
                ? "Graded"
                : submission.status === "SUBMITTED"
                  ? "Awaiting grade"
                  : "In progress"}
            </Badge>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {student.fullName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {student.email}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5" />
              {submission.submittedAt
                ? `Submitted ${dateFmt.format(submission.submittedAt)}`
                : `Started ${dateFmt.format(submission.startedAt)}`}
            </span>
            {existingGrade && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <GraduationCap className="size-3.5" />
                Previous: {existingGrade.score}/{existingGrade.outOf}
              </span>
            )}
          </div>
        </header>

        <GradingForm
          submissionId={submission.id}
          testId={test.id}
          studentName={student.fullName}
          questions={questions}
          answers={answers}
          existingQuestionGrades={existingQuestionGrades}
          existingGrade={existingGrade}
        />
      </div>
    </div>
  );
}
