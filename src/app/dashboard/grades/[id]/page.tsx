/**
 * /dashboard/grades/[id] - canonical student-facing grade detail.
 *
 * Server Component. One page handles both test and assignment grades; the
 * shape of the body switches on whether the grade row links to a
 * testSubmission or a submissionEntry.
 *
 * Layout:
 *   1. Header bar with back link.
 *   2. Hero: title, course, type pill, big score callout (Inkwell terracotta).
 *   3. Tutor's overall feedback as a markdown card.
 *   4. Per-item breakdown - per-question for tests, per-file for assignments.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  MessageSquare,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LessonMarkdown from "@/app/components/markdown";

import {
  getGradeWithDetails,
  type GradeDetail,
} from "@/features/grades/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function pct(score: number, outOf: number): number {
  if (outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}

export const metadata = { title: "Grade" };

export default async function GradeDetailPage({ params }: PageProps) {
  const { id } = await params;

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

  const grade = await getGradeWithDetails(id);
  if (!grade) notFound();
  if (grade.studentId !== student.id) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        This grade isn&apos;t yours.
      </div>
    );
  }

  const overallPct = pct(grade.score, grade.outOf);
  const isTest = grade.testSubmission !== null;

  return (
    <div className="bg-background min-h-screen">
      {/* ───── Header bar ───── */}
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/grades">
                <ArrowLeft className="size-4" /> All grades
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        {/* ───── Hero ───── */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs">
              {grade.course.name}
              {grade.course.tutor.fullName ? ` - with ${grade.course.tutor.fullName}` : ""}
            </p>
            <Badge variant="secondary">
              {isTest ? "Test" : "Assignment"}
            </Badge>
          </div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {grade.title}
          </h1>
          <p className="text-muted-foreground text-xs">
            Graded {dateFmt.format(grade.updatedAt)}
          </p>
        </header>

        {/* ───── Score callout ───── */}
        <Card className="bg-brand-terracotta/8 border-brand-terracotta/30 flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-brand-terracotta/15 text-brand-terracotta flex size-14 items-center justify-center rounded-md">
              <GraduationCap className="size-7" />
            </div>
            <div>
              <p className="font-display text-4xl tabular-nums text-foreground">
                {grade.score}
                <span className="text-muted-foreground"> / {grade.outOf}</span>
              </p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {grade.outOf > 0 ? `${overallPct}% overall` : ""}
              </p>
            </div>
          </div>
          {grade.outOf > 0 && (
            <Badge
              variant={overallPct >= 50 ? "soft" : "secondary"}
              className="tabular-nums px-3 py-1.5 text-base"
            >
              {overallPct}%
            </Badge>
          )}
        </Card>

        {/* ───── Final feedback ───── */}
        {grade.finalComments && (
          <Card className="space-y-3 p-6">
            <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
              <MessageSquare className="text-brand-terracotta size-4" />
              Tutor feedback
            </h2>
            <LessonMarkdown content={grade.finalComments} />
          </Card>
        )}

        {/* ───── Per-item body ───── */}
        {isTest ? (
          <TestBreakdown grade={grade} />
        ) : (
          <SubmissionBreakdown grade={grade} />
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* TEST grade body                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function TestBreakdown({ grade }: { grade: GradeDetail }) {
  const sub = grade.testSubmission;
  if (!sub) return null;
  const test = sub.test;

  // Index per-question grades by questionId for fast lookup.
  const qgByQ = new Map(sub.questionGrades.map((qg) => [qg.questionId, qg]));

  // Coerce stored answers into a record keyed by questionId.
  const answers: Record<string, unknown> =
    sub.answers && typeof sub.answers === "object" && !Array.isArray(sub.answers)
      ? (sub.answers as Record<string, unknown>)
      : {};

  // Group questions by parent for tree walk.
  type Q = (typeof test.questions)[number];
  const byParent = new Map<string | null, Q[]>();
  for (const q of test.questions) {
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
  const top = byParent.get(null) ?? [];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
          Question breakdown
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {top.length} {top.length === 1 ? "question" : "questions"}
        </span>
      </div>
      <Separator />
      <ol className="divide-border divide-y">
        {top.map((q, i) => (
          <li key={q.id} className="px-5 py-5">
            <QuestionReview
              question={q}
              path={String(i + 1)}
              children_={byParent.get(q.id) ?? []}
              byParent={byParent}
              qgByQ={qgByQ}
              answers={answers}
            />
          </li>
        ))}
      </ol>
    </Card>
  );
}

const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

type QuestionRow = {
  id: string;
  parentId: string | null;
  order: number | null;
  type: string;
  question: string;
  points: number;
  options: string[];
  blankCount: number | null;
  reorderItems: string[];
  matchPairs: unknown;
};

type QGRow = {
  score: number;
  outOf: number;
  feedback: string | null;
};

function QuestionReview({
  question,
  path,
  children_,
  byParent,
  qgByQ,
  answers,
  depth = 0,
}: {
  question: QuestionRow;
  path: string;
  children_: QuestionRow[];
  byParent: Map<string | null, QuestionRow[]>;
  qgByQ: Map<string | null, QGRow>;
  answers: Record<string, unknown>;
  depth?: number;
}) {
  const isContext = (question.type as string) === "NONE";
  const qg = qgByQ.get(question.id);
  const studentAnswer = answers[question.id];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={isContext ? "text-muted-foreground text-xs font-medium tabular-nums" : "text-brand-terracotta text-xs font-medium tabular-nums"}>
            {isContext
              ? `Context ${path}`
              : `Question ${path} - ${question.points} ${question.points === 1 ? "point" : "points"}`}
          </p>
          <div className="mt-1">
            <LessonMarkdown content={question.question} />
          </div>
        </div>
        {qg && !isContext && (
          <div className="text-right shrink-0">
            <p className="font-display tabular-nums text-foreground text-sm">
              {qg.score}
              <span className="text-muted-foreground"> / {qg.outOf}</span>
            </p>
            {qg.score === qg.outOf && qg.outOf > 0 && (
              <CheckCircle2 className="text-brand-terracotta ml-auto mt-0.5 size-4" />
            )}
          </div>
        )}
      </div>

      {!isContext && (
        <AnswerView question={question} value={studentAnswer} />
      )}

      {qg?.feedback && (
        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
            Tutor feedback
          </p>
          <LessonMarkdown content={qg.feedback} />
        </div>
      )}

      {children_.length > 0 && (
        <div className="space-y-4 border-l-2 border-brand-terracotta/20 pl-4 sm:pl-6">
          {children_.map((c, i) => {
            const childPath =
              depth === 0
                ? `${path}.${SUB_LETTERS[i % SUB_LETTERS.length] ?? i + 1}`
                : `${path}.${i + 1}`;
            return (
              <QuestionReview
                key={c.id}
                question={c}
                path={childPath}
                children_={byParent.get(c.id) ?? []}
                byParent={byParent}
                qgByQ={qgByQ}
                answers={answers}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* AnswerView - renders the student's stored answer per question type.       */
/* ──────────────────────────────────────────────────────────────────────── */

function AnswerView({
  question,
  value,
}: {
  question: QuestionRow;
  value: unknown;
}) {
  const empty =
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (empty) {
    return (
      <p className="text-muted-foreground italic text-xs">No answer recorded.</p>
    );
  }

  const wrap = (label: string, body: React.ReactNode) => (
    <div className="border-border rounded-md border p-3">
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      {body}
    </div>
  );

  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
      return wrap("Your answer", (
        <p className="text-foreground text-sm">{String(value)}</p>
      ));

    case "ESSAY":
    case "CODE":
      return wrap("Your answer", (
        <div className={question.type === "CODE" ? "font-mono text-xs whitespace-pre-wrap text-foreground" : "text-foreground text-sm whitespace-pre-wrap"}>
          {String(value)}
        </div>
      ));

    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap("Your selections", (
        <ul className="text-foreground text-sm list-disc pl-5">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      ));
    }

    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap("Your answers", (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-1">
          {arr.map((v, i) => (
            <li key={i}>{v || <span className="text-muted-foreground italic">blank</span>}</li>
          ))}
        </ol>
      ));
    }

    case "REORDER": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap("Your order", (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-1">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ol>
      ));
    }

    case "MATCHING": {
      const arr = Array.isArray(value)
        ? (value as Array<{ left: string; right: string }>)
        : [];
      return wrap("Your matches", (
        <ul className="text-foreground text-sm space-y-1">
          {arr.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.left}</span>
              <span className="text-muted-foreground"> → </span>
              <span>{p.right}</span>
            </li>
          ))}
        </ul>
      ));
    }

    case "FILE_UPLOAD": {
      const v = value as { fileUrl?: string; fileName?: string } | null;
      if (!v?.fileUrl) {
        return wrap("Your file", (
          <p className="text-muted-foreground italic text-xs">No file uploaded.</p>
        ));
      }
      return wrap("Your file", (
        <a
          href={v.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand-terracotta inline-flex items-center gap-1 text-sm hover:underline"
        >
          <FileText className="size-3" />
          {v.fileName ?? "View file"}
          <ExternalLink className="size-3" />
        </a>
      ));
    }

    default:
      return wrap("Your answer", (
        <pre className="text-foreground text-xs whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      ));
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* SUBMISSION grade body                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

function SubmissionBreakdown({ grade }: { grade: GradeDetail }) {
  const entry = grade.submissionEntry;
  if (!entry) return null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Your submission
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            Attempt {entry.attemptNumber}
          </span>
        </div>
        <Separator />
        {entry.fileUrl.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            No files were uploaded.
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {entry.fileUrl.map((url) => {
              const name = url.split("/").pop() ?? "file";
              return (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {decodeURIComponent(name)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Click to open
                      </p>
                    </div>
                    <ExternalLink className="text-muted-foreground size-4 shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {entry.feedback && entry.feedback !== grade.finalComments && (
        <Card className="space-y-3 p-6">
          <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
            <MessageSquare className="text-brand-terracotta size-4" />
            Submission notes
          </h2>
          <LessonMarkdown content={entry.feedback} />
        </Card>
      )}

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/dashboard/submissions/${entry.submission.id}`}>
            Open assignment page
          </Link>
        </Button>
      </div>
    </div>
  );
}
