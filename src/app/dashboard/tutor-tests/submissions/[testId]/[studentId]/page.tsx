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

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";

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
import { SubmissionAdminPanel } from "@/features/assessments/components/submission-admin-panel";
import { AutoGradeButton } from "@/features/assessments/components/auto-grade-button";
import { TestFrame } from "@/features/assessments/components/test-frame";

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
      correctAnswer: q.answer,
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
      <TestFrame test={test} view="submissions" page={student.fullName}>
        <div className="mx-auto flex min-h-[320px] w-full max-w-3xl items-center justify-center px-4 py-10">
          <EmptyState
            compact
            illustration={<Scene name="nothing-to-grade" />}
            title="No submission"
            description={`${student.fullName} hasn't started this test yet.`}
          />
        </div>
      </TestFrame>
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

  const chip =
    submission.status === "GRADED"
      ? { tone: "success" as const, label: "Graded" }
      : submission.status === "SUBMITTED"
        ? { tone: "info" as const, label: "To mark" }
        : { tone: "neutral" as const, label: "In progress" };

  return (
    <TestFrame test={test} view="submissions" page={student.fullName} actions={<AutoGradeButton submissionId={submission.id} />}>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">
              {student.fullName}
            </h1>
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          </div>
          <PropertyList>
            <PropertyRow label="Email">{student.email}</PropertyRow>
            <PropertyRow label={submission.submittedAt ? "Submitted" : "Started"}>
              <span className="tabular-nums">{dateFmt.format(submission.submittedAt ?? submission.startedAt)}</span>
            </PropertyRow>
            {existingGrade ? (
              <PropertyRow label="Current grade">
                <span className="tabular-nums">
                  {existingGrade.score} / {existingGrade.outOf}
                </span>
              </PropertyRow>
            ) : null}
          </PropertyList>
        </header>

        <GradingForm
          submissionId={submission.id}
          testId={test.id}
          studentName={student.fullName}
          questions={questions}
          answers={answers}
          existingQuestionGrades={existingQuestionGrades}
          existingGrade={existingGrade}
          labelScheme={test.labelScheme}
        />

        <SubmissionAdminPanel
          submissionId={submission.id}
          testId={test.id}
          studentName={student.fullName}
          initialStatus={submission.status as "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "LATE" | "NOT_SUBMITTED"}
        />
      </div>
    </TestFrame>
  );
}
