/**
 * /dashboard/tests/review/[id] — student review of a submitted test.
 *
 * Server Component. Loads the test detail + student's submission + per-
 * question grades. Renders:
 *   1. Back link + course meta + status pill.
 *   2. Score callout (only if a Grade exists; otherwise a "pending" card).
 *   3. Performance summary table (name, submitted-at, auto/pending counts,
 *      total questions, current score).
 *   4. Per-question breakdown with colour-coded status per question:
 *      green = correct, red = incorrect, amber = pending, muted = context.
 *      Student's answer displayed inline; correct answer revealed for
 *      graded questions so the student learns from the mistake.
 *
 * All the section chrome respects the design system (LessonMarkdown for
 * markdown+MathJax, Badge variants for status). No client JS beyond what
 * LessonMarkdown already ships.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Hourglass,
  Wand2,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import LessonMarkdown from "@/app/components/markdown";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
} from "@/features/assessments/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const metadata = { title: "Test review" };

/* ─── Types ────────────────────────────────────────────────────────────── */

type QuestionRow = {
  id: string;
  parentId: string | null;
  order: number | null;
  createdAt: Date;
  type: string;
  question: string;
  points: number;
  options: string[];
  answer: unknown;
  matchPairs: unknown;
  reorderItems: string[];
  blankCount: number | null;
};

/* ──────────────────────────────────────────────────────────────────────── */

export default async function TestReviewPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true, fullName: true },
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

  // Whether the tutor allowed auto-marked grades to reach the student.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const releaseAutoMarks: boolean = (test as any).releaseAutoMarksToStudent ?? false;

  // Index per-question grades by questionId.
  const qgByQ = new Map(
    submission.questionGrades.map((qg) => [qg.questionId, qg]),
  );
  // Coerce answers JSON into a record.
  const answers: Record<string, unknown> =
    submission.answers &&
    typeof submission.answers === "object" &&
    !Array.isArray(submission.answers)
      ? (submission.answers as Record<string, unknown>)
      : {};

  // Group + sort top-level questions.
  const questions = test.questions as unknown as QuestionRow[];
  const byParent = new Map<string | null, QuestionRow[]>();
  for (const q of questions) {
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
  const topQuestions = byParent.get(null) ?? [];

  // Tallies for the summary strip. Walk every gradable node in the tree.
  const stats = { total: 0, answered: 0, autoMarked: 0, pending: 0, correct: 0 };
  function tally(q: QuestionRow) {
    if (q.type !== "NONE") {
      stats.total += 1;
      const answered = hasAnswer(answers[q.id]);
      if (answered) stats.answered += 1;
      const qg = qgByQ.get(q.id);
      if (qg) {
        stats.autoMarked += 1;
        if (qg.outOf > 0 && qg.score === qg.outOf) stats.correct += 1;
      } else {
        stats.pending += 1;
      }
    }
    (byParent.get(q.id) ?? []).forEach(tally);
  }
  topQuestions.forEach(tally);

  const status = submission.status;
  const graded = status === "GRADED";
  const grade = submission.grade;
  const canSeeGrades = releaseAutoMarks || graded;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/dashboard/courses/${test.courseId}`}>
          <ArrowLeft className="size-4" /> Back to course
        </Link>
      </Button>

      {/* ───── Hero header ───── */}
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
              graded
                ? "brand"
                : status === "SUBMITTED"
                  ? "soft"
                  : "secondary"
            }
          >
            {graded
              ? "Graded"
              : status === "SUBMITTED"
                ? "Awaiting grade"
                : status}
          </Badge>
        </div>
      </header>

      {/* ───── Summary table ───── */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm leading-tight text-foreground">
            Performance summary
          </h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-4">
          <SummaryStat label="Student" value={student.fullName} />
          <SummaryStat
            label="Submitted"
            value={
              submission.submittedAt
                ? dateFmt.format(submission.submittedAt)
                : "—"
            }
          />
          <SummaryStat
            label="Time limit"
            value={test.timeLimit ? `${test.timeLimit} min` : "Untimed"}
          />
          <SummaryStat
            label="Total questions"
            value={String(stats.total)}
          />
          <SummaryStat
            label="Answered"
            value={`${stats.answered}/${stats.total}`}
          />
          {canSeeGrades ? (
            <>
              <SummaryStat
                label="Auto-marked"
                value={`${stats.autoMarked}/${stats.total}`}
              />
              <SummaryStat
                label="Pending review"
                value={String(stats.pending)}
                muted={stats.pending === 0}
              />
              <SummaryStat
                label={graded ? "Final score" : "Score so far"}
                value={
                  grade
                    ? `${grade.score}/${grade.outOf}`
                    : "—"
                }
                strong
              />
            </>
          ) : (
            <SummaryStat
              label="Grade"
              value="Hidden until released"
              muted
            />
          )}
        </dl>
      </Card>

      {/* ───── Overall score callout (only when there's a grade to show) ───── */}
      {canSeeGrades && grade && (
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
                  ? `${Math.round((grade.score / grade.outOf) * 100)}% ${graded ? "overall" : "so far"}`
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

      {/* ───── Per-question breakdown ───── */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Questions
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {topQuestions.length}{" "}
            {topQuestions.length === 1 ? "question" : "questions"}
          </span>
        </div>
        <Separator />
        <ol className="divide-border divide-y">
          {topQuestions.map((q, i) => (
            <li key={q.id} className="px-5 py-5">
              <ReviewNode
                q={q}
                path={String(i + 1)}
                answers={answers}
                qgByQ={qgByQ}
                byParent={byParent}
                canSeeGrades={canSeeGrades}
              />
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ─── Helpers + subcomponents ──────────────────────────────────────────── */

function hasAnswer(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function SummaryStat({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm tabular-nums",
          strong && "font-display text-base text-foreground",
          !strong && !muted && "text-foreground",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

function ReviewNode({
  q,
  path,
  answers,
  qgByQ,
  byParent,
  canSeeGrades,
  depth = 0,
}: {
  q: QuestionRow;
  path: string;
  answers: Record<string, unknown>;
  qgByQ: Map<string | null, { score: number; outOf: number; feedback: string | null }>;
  byParent: Map<string | null, QuestionRow[]>;
  canSeeGrades: boolean;
  depth?: number;
}) {
  const isContext = q.type === "NONE";
  const qg = qgByQ.get(q.id);
  const answered = hasAnswer(answers[q.id]);

  // Status → colour scheme. Applied to the left border of each card so the
  // student can scan the list vertically for correctness at a glance.
  //   green — correct
  //   red   — incorrect
  //   amber — pending review (subjective, no grade yet)
  //   muted — context block
  let statusTone: "correct" | "wrong" | "pending" | "unanswered" | "context";
  if (isContext) statusTone = "context";
  else if (!qg) statusTone = answered ? "pending" : "unanswered";
  else if (qg.outOf > 0 && qg.score === qg.outOf) statusTone = "correct";
  else if (qg.score === 0) statusTone = "wrong";
  else statusTone = "correct"; // partial credit — count as correct-ish

  const toneBorder = {
    correct: "border-l-emerald-500/70",
    wrong: "border-l-red-500/70",
    pending: "border-l-amber-500/70",
    unanswered: "border-l-slate-300",
    context: "border-l-muted-foreground/30",
  }[statusTone];

  const tonePill = {
    correct: { label: "Correct", cls: "bg-emerald-100 text-emerald-800" },
    wrong: { label: "Incorrect", cls: "bg-red-100 text-red-800" },
    pending: { label: "Pending review", cls: "bg-amber-100 text-amber-800" },
    unanswered: { label: "Not answered", cls: "bg-slate-100 text-slate-600" },
    context: { label: "Context", cls: "bg-slate-100 text-slate-600" },
  }[statusTone];

  const children = byParent.get(q.id) ?? [];

  return (
    <div className={cn("space-y-3 border-l-4 pl-4", toneBorder)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium tabular-nums">
            {isContext ? `Context ${path}` : `Question ${path} · ${q.points} ${q.points === 1 ? "point" : "points"}`}
          </p>
          <div className="mt-1">
            <LessonMarkdown content={q.question} className="prose-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canSeeGrades && !isContext && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                tonePill.cls,
              )}
            >
              {statusTone === "correct" && <CheckCircle2 className="size-3" />}
              {statusTone === "wrong" && <XCircle className="size-3" />}
              {statusTone === "pending" && <Hourglass className="size-3" />}
              {statusTone === "unanswered" && <AlertTriangle className="size-3" />}
              {tonePill.label}
            </span>
          )}
          {canSeeGrades && qg && (
            <span className="font-display tabular-nums text-foreground text-sm">
              {qg.score}
              <span className="text-muted-foreground"> / {qg.outOf}</span>
            </span>
          )}
        </div>
      </div>

      {!isContext && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnswerBlock
            title="Your answer"
            tone={
              !answered
                ? "muted"
                : statusTone === "correct"
                  ? "correct"
                  : statusTone === "wrong"
                    ? "wrong"
                    : "neutral"
            }
            body={<AnswerView type={q.type} value={answers[q.id]} />}
          />
          {canSeeGrades && (statusTone === "wrong" || statusTone === "pending") && (
            <AnswerBlock
              title="Correct answer"
              tone="correct-outline"
              body={<CorrectAnswerView q={q} />}
            />
          )}
        </div>
      )}

      {canSeeGrades && qg?.feedback && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-800">
            <Wand2 className="size-3" />
            Tutor feedback
          </p>
          <LessonMarkdown content={qg.feedback} className="prose-sm" />
        </div>
      )}

      {!isContext && !answered && (
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs italic">
          <Clock className="size-3" />
          You didn&apos;t answer this question.
        </p>
      )}

      {children.length > 0 && (
        <div className="mt-3 space-y-4">
          {children.map((c, i) => {
            const seg =
              depth === 0
                ? SUB_LETTERS[i % SUB_LETTERS.length] ?? String(i + 1)
                : String(i + 1);
            return (
              <ReviewNode
                key={c.id}
                q={c}
                path={`${path}.${seg}`}
                answers={answers}
                qgByQ={qgByQ}
                byParent={byParent}
                canSeeGrades={canSeeGrades}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerBlock({
  title,
  tone,
  body,
}: {
  title: string;
  tone: "correct" | "wrong" | "muted" | "neutral" | "correct-outline";
  body: React.ReactNode;
}) {
  const cls = {
    correct: "border-emerald-200 bg-emerald-50",
    wrong: "border-red-200 bg-red-50",
    muted: "border-slate-200 bg-slate-50/60",
    neutral: "border-border bg-muted/40",
    "correct-outline": "border-emerald-300 bg-white",
  }[tone];
  return (
    <div className={cn("rounded-md border p-3 text-sm", cls)}>
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {title}
      </p>
      {body}
    </div>
  );
}

function AnswerView({ type, value }: { type: string; value: unknown }) {
  const empty =
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (empty) {
    return <p className="text-muted-foreground italic text-xs">No answer recorded.</p>;
  }
  switch (type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
      return <div className="text-foreground"><LessonMarkdown content={String(value)} className="prose-sm" /></div>;
    case "ESSAY":
    case "CODE":
      return (
        <div className={type === "CODE" ? "font-mono text-xs whitespace-pre-wrap text-foreground" : "text-foreground whitespace-pre-wrap"}>
          {String(value)}
        </div>
      );
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ul className="text-foreground list-disc pl-5 space-y-0.5">
          {arr.map((v, i) => <li key={i}><LessonMarkdown content={v} className="prose-sm" /></li>)}
        </ul>
      );
    }
    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ol className="text-foreground list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>{v || <span className="text-muted-foreground italic">blank</span>}</li>
          ))}
        </ol>
      );
    }
    case "REORDER": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ol className="text-foreground list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => <li key={i}><LessonMarkdown content={v} className="prose-sm" /></li>)}
        </ol>
      );
    }
    case "MATCHING": {
      const arr = Array.isArray(value) ? (value as Array<{ left: string; right: string }>) : [];
      return (
        <ul className="text-foreground space-y-1">
          {arr.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0"><LessonMarkdown content={p.left} className="prose-sm" /></span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="min-w-0"><LessonMarkdown content={p.right} className="prose-sm" /></span>
            </li>
          ))}
        </ul>
      );
    }
    case "FILE_UPLOAD": {
      const v = value as { fileUrl?: string; fileName?: string } | null;
      if (!v?.fileUrl) return <p className="text-muted-foreground italic text-xs">No file uploaded.</p>;
      return (
        <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-brand-terracotta inline-flex items-center gap-1 text-sm hover:underline">
          <FileText className="size-3" />
          {v.fileName ?? "View file"}
          <ExternalLink className="size-3" />
        </a>
      );
    }
    default:
      return (
        <pre className="text-foreground text-xs whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
  }
}

function CorrectAnswerView({ q }: { q: QuestionRow }) {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
      if (q.answer == null || (typeof q.answer === "string" && q.answer.trim() === "")) {
        return <p className="text-muted-foreground italic text-xs">Tutor-only — graded manually.</p>;
      }
      return <div className="text-foreground"><LessonMarkdown content={String(q.answer)} className="prose-sm" /></div>;

    case "MULTI_SELECT": {
      const arr = Array.isArray(q.answer) ? (q.answer as string[]) : [];
      if (arr.length === 0) return <p className="text-muted-foreground italic text-xs">No key provided.</p>;
      return (
        <ul className="text-foreground list-disc pl-5 space-y-0.5">
          {arr.map((v, i) => <li key={i}><LessonMarkdown content={v} className="prose-sm" /></li>)}
        </ul>
      );
    }

    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(q.answer) ? (q.answer as string[]) : [];
      if (arr.length === 0) return <p className="text-muted-foreground italic text-xs">No key provided.</p>;
      return (
        <ol className="text-foreground list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ol>
      );
    }

    case "REORDER": {
      const arr = q.reorderItems ?? [];
      if (arr.length === 0) return <p className="text-muted-foreground italic text-xs">No key provided.</p>;
      return (
        <ol className="text-foreground list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => <li key={i}><LessonMarkdown content={v} className="prose-sm" /></li>)}
        </ol>
      );
    }

    case "MATCHING": {
      const pairs = (q.matchPairs ?? []) as Array<{ left: string; right: string }>;
      if (pairs.length === 0) return <p className="text-muted-foreground italic text-xs">No pairs provided.</p>;
      return (
        <ul className="text-foreground space-y-1">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0"><LessonMarkdown content={p.left} className="prose-sm" /></span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="min-w-0"><LessonMarkdown content={p.right} className="prose-sm" /></span>
            </li>
          ))}
        </ul>
      );
    }

    case "ESSAY":
    case "CODE":
    case "FILE_UPLOAD":
    case "NONE":
      return <p className="text-muted-foreground italic text-xs">Graded manually — no fixed correct answer.</p>;

    default:
      return null;
  }
}
