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
 * Framed (#205, the plan's "Grade a submission" example; #150): the
 * primary header holds the student and the live score, the secondary
 * header Previous and Next, the rubric and the AI suggestions.
 */

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusChip } from "@/components/shell/status-chip";
import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import type { Crumb } from "@/components/shell/page-header";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
  listSubmissionsForTest,
  testBelongsToTutor,
  type TestDetail,
} from "@/features/assessments/queries";
import { suggestionsFor } from "@/features/ai-marking/jobs";
import { rubricFor } from "@/features/ai-marking/rules";
import { readRubric } from "@/features/assessments/lib/rubric";
import {
  GradingRibbon,
  GradingSessionProvider,
  LiveScore,
} from "@/features/assessments/components/grading-session";
import { latestPerStudent } from "@/features/assessments/lib/item-analysis";
import { markingProgress, nextToMark } from "@/features/assessments/lib/marking-flow";
import { commentsUsedOnTest } from "@/features/assessments/marking-comments";
import { neighbours, writtenQuestions, type AiSuggestion } from "@/features/assessments/lib/ai-marking-ui";
import { courseRoutes } from "@/features/courses/components/course-frame";
import {
  GradingForm,
  type GradingQuestion,
} from "@/features/assessments/components/grading-form";
import { SubmissionAdminPanel } from "@/features/assessments/components/submission-admin-panel";
import { AutoGradeButton } from "@/features/assessments/components/auto-grade-button";
import { TestFrame, testRoutes } from "@/features/assessments/components/test-frame";
import { getCourseScope } from "@/features/courses/course-access";
import { schoolDateFormat } from "@/lib/datetime";

interface PageProps {
  params: Promise<{ testId: string; studentId: string }>;
}

const dateFmt = schoolDateFormat({
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const metadata = { title: "Mark submission" };

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
      mathMode: q.mathMode ?? null,
      rubric: readRubric(q.rubric),
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

  const scope = await getCourseScope(session.user.id);

  const owns = await testBelongsToTutor(testId, scope);
  if (!owns) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: testRoutes.list }, { label: "Submission" }]}>
        Only staff who teach or manage this test&apos;s course can open this page.
      </PageMessage>
    );
  }

  const [test, student, submission, all] = await Promise.all([
    getTestDetailById(testId),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, email: true, imageUrl: true },
    }),
    getTestSubmissionByStudentAndTest(studentId, testId),
    listSubmissionsForTest(testId),
  ]);
  if (!test) notFound();
  if (!student) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: testRoutes.list }, { label: "Submission" }]}>
        Student not found.
      </PageMessage>
    );
  }
  if (!submission) {
    return (
      <TestFrame test={test} view="submissions" page={student.fullName}>
        <EmptyState
          compact
          illustration={<Scene name="nothing-to-grade" />}
          title="Not started"
          description={`${student.fullName} hasn't started this test yet. Their answers show here once they do.`}
        />
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
    criteria: qg.criteria,
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
      ? { tone: "success" as const, label: "Marked" }
      : submission.status === "SUBMITTED"
        ? { tone: "info" as const, label: "To mark" }
        : { tone: "neutral" as const, label: "In progress" };

  // Previous and Next follow the submissions list's order.
  const near = neighbours(all, studentId);
  const href = (sid: string) => `/dashboard/tutor-tests/submissions/${test.id}/${sid}`;

  // How far the marker is, the next script, and comments to use again.
  const scripts = latestPerStudent(all.filter((s) => s.status !== "IN_PROGRESS"));
  const progress = markingProgress(scripts);
  const after = nextToMark(scripts, studentId);
  const comments = await commentsUsedOnTest(test.id, all.map((s) => s.student.fullName));

  // AI-suggested marks (#150), when the test has them on.
  const suggestions: AiSuggestion[] | null = test.aiMarking ? ((await suggestionsFor(submission.id)) as AiSuggestion[]) : null;
  const byId = new Map(test.questions.map((q) => [q.id, q]));
  const rubrics = writtenQuestions(test.questions, test.labelScheme).map((w) => {
    const q = byId.get(w.id)!;
    return { id: w.id, label: w.label, points: q.points, rubric: rubricFor(q.rubric, q.points) };
  });

  const crumbs: Crumb[] = [
    { label: "Tests", href: testRoutes.list },
    { label: test.course.name, href: courseRoutes.overview(test.courseId) },
    { label: test.title, href: testRoutes.questions(test.id) },
    { label: "Submissions", href: testRoutes.submissions(test.id) },
    { label: student.fullName },
  ];

  return (
    <GradingSessionProvider>
      <PageFrame
        type="record"
        breadcrumb={crumbs}
        status={<StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
        actions={
          <>
            <LiveScore initial={existingGrade ? { score: existingGrade.score, outOf: existingGrade.outOf } : null} />
            <AutoGradeButton submissionId={submission.id} />
          </>
        }
        secondary={
          <GradingRibbon
            prevHref={near.prev ? href(near.prev.studentId) : null}
            nextHref={near.next ? href(near.next.studentId) : null}
            position={near.index >= 0 ? `${near.index + 1} of ${all.length}` : null}
            rubrics={rubrics}
            aiEnabled={suggestions !== null}
            progress={progress}
          />
        }
      >
        <PageTitle
          eyebrow={test.title}
          title={student.fullName}
          properties={
            <PropertyList>
              <PropertyRow label="Email">{student.email}</PropertyRow>
              <PropertyRow label={submission.submittedAt ? "Handed in" : "Started"}>
                <span className="tabular-nums">{dateFmt.format(submission.submittedAt ?? submission.startedAt)}</span>
              </PropertyRow>
              {existingGrade ? (
                <PropertyRow label="Saved mark">
                  <span className="tabular-nums">
                    {existingGrade.score} / {existingGrade.outOf}
                  </span>
                </PropertyRow>
              ) : null}
            </PropertyList>
          }
        />

        <GradingForm
          submissionId={submission.id}
          testId={test.id}
          studentName={student.fullName}
          questions={questions}
          answers={answers}
          existingQuestionGrades={existingQuestionGrades}
          existingGrade={existingGrade}
          labelScheme={test.labelScheme}
          ai={suggestions ? { initial: suggestions } : null}
          comments={comments}
          next={after ? { href: href(after.studentId), name: after.student.fullName } : null}
        />

        <SubmissionAdminPanel
          submissionId={submission.id}
          testId={test.id}
          studentName={student.fullName}
          initialStatus={submission.status as "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "LATE" | "NOT_SUBMITTED"}
        />
      </PageFrame>
    </GradingSessionProvider>
  );
}
