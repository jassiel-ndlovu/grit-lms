"use client";

/**
 * GradingForm — tutor grades a single student's test submission.
 *
 * Owns the per-question grade state (score + feedback per question) plus
 * an overall feedback field. Overall score defaults to the sum of every
 * per-question score but the tutor can override with a manual value.
 *
 * On submit → gradeTestSubmission({ submissionId, score, outOf, feedback,
 * questionGrades }). That action is transactional: upserts the Grade row
 * and replaces every QuestionGrade in one write.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import LessonMarkdown from "@/app/components/markdown";

import { gradeTestSubmission } from "../actions";

/* ─── Shapes ───────────────────────────────────────────────────────────── */

export type GradingQuestion = {
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
  // Tutor's correct-answer key from test creation — displayed alongside
  // the student's answer so the tutor can compare at a glance.
  correctAnswer: unknown;
  subQuestions: GradingQuestion[];
};

export type GradingExistingQG = {
  questionId: string | null;
  score: number;
  outOf: number;
  feedback: string | null;
};

export interface GradingFormProps {
  submissionId: string;
  testId: string;
  studentName: string;
  /** Top-level questions; sub-questions live on subQuestions. */
  questions: GradingQuestion[];
  /** Raw answers JSON stored on the TestSubmission — keyed by questionId. */
  answers: Record<string, unknown>;
  /** Pre-existing per-question grades (if any). */
  existingQuestionGrades: GradingExistingQG[];
  /** Existing overall grade (if any). */
  existingGrade: {
    score: number;
    outOf: number;
    finalComments: string | null;
  } | null;
}

/* ─── Flattening + helpers ─────────────────────────────────────────────── */

/**
 * Depth-first flatten of the question tree with a dotted display label
 * ("1", "1.a", "1.b", "2"). Skips NONE-typed questions since they aren't
 * gradable — but keeps them as visible context blocks in the rendered form.
 */
type FlatRow = {
  q: GradingQuestion;
  path: string;
  depth: number;
  parentText: string | null;
  gradable: boolean;
};
const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

function flatten(questions: GradingQuestion[]): FlatRow[] {
  const out: FlatRow[] = [];
  function visit(q: GradingQuestion, parentPath: string, depth: number, parentText: string | null) {
    out.push({
      q,
      path: parentPath,
      depth,
      parentText,
      gradable: q.type !== "NONE",
    });
    q.subQuestions.forEach((child, i) => {
      const seg =
        depth === 0
          ? SUB_LETTERS[i % SUB_LETTERS.length] ?? String(i + 1)
          : String(i + 1);
      visit(child, `${parentPath}.${seg}`, depth + 1, q.question);
    });
  }
  questions.forEach((q, i) => visit(q, String(i + 1), 0, null));
  return out;
}

function pct(score: number, outOf: number) {
  if (outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function GradingForm({
  submissionId,
  testId,
  studentName,
  questions,
  answers,
  existingQuestionGrades,
  existingGrade,
}: GradingFormProps) {
  const router = useRouter();
  const rows = React.useMemo(() => flatten(questions), [questions]);
  const gradableRows = rows.filter((r) => r.gradable);

  // Index existing per-question grades by questionId.
  const initialByQ = React.useMemo(() => {
    const m = new Map<string, { score: number; feedback: string }>();
    for (const g of existingQuestionGrades) {
      if (g.questionId) {
        m.set(g.questionId, {
          score: g.score,
          feedback: g.feedback ?? "",
        });
      }
    }
    return m;
  }, [existingQuestionGrades]);

  // Per-question grade state: score is a string so empty is representable.
  type PerQ = { score: string; feedback: string };
  const [perQ, setPerQ] = React.useState<Record<string, PerQ>>(() => {
    const seed: Record<string, PerQ> = {};
    for (const r of gradableRows) {
      const prior = initialByQ.get(r.q.id);
      seed[r.q.id] = {
        score: prior ? String(prior.score) : "",
        feedback: prior?.feedback ?? "",
      };
    }
    return seed;
  });

  const [overallFeedback, setOverallFeedback] = React.useState(
    existingGrade?.finalComments ?? "",
  );
  // Overall score can be auto (sum of per-question) or manual override.
  const [overrideOverall, setOverrideOverall] = React.useState<string | null>(
    existingGrade ? String(existingGrade.score) : null,
  );
  const [pending, setPending] = React.useState(false);

  /* ─── Derived totals ─── */

  const outOfTotal = gradableRows.reduce((s, r) => s + r.q.points, 0);
  const scoreSum = gradableRows.reduce((s, r) => {
    const v = perQ[r.q.id]?.score;
    if (!v || v.trim() === "") return s;
    const n = Number(v);
    return Number.isFinite(n) ? s + n : s;
  }, 0);
  const effectiveScore =
    overrideOverall && overrideOverall.trim() !== ""
      ? Number(overrideOverall)
      : scoreSum;
  const overallPct = pct(effectiveScore, outOfTotal);
  const allGraded = gradableRows.every((r) => {
    const v = perQ[r.q.id]?.score;
    return v !== undefined && v.trim() !== "";
  });

  /* ─── Handlers ─── */

  function updateScore(qid: string, next: string) {
    setPerQ((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { score: "", feedback: "" }), score: next },
    }));
  }
  function updateFeedback(qid: string, next: string) {
    setPerQ((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? { score: "", feedback: "" }), feedback: next },
    }));
  }
  function assignFull(qid: string, points: number) {
    updateScore(qid, String(points));
  }

  async function onSubmit() {
    if (outOfTotal <= 0) {
      toast.error("This test has no gradable questions.");
      return;
    }
    setPending(true);
    try {
      const questionGrades = gradableRows.map((r) => {
        const raw = perQ[r.q.id]?.score ?? "";
        const parsed = raw.trim() === "" ? 0 : Number(raw);
        return {
          questionId: r.q.id,
          score: Number.isFinite(parsed) ? parsed : 0,
          outOf: r.q.points,
          feedback:
            perQ[r.q.id]?.feedback && perQ[r.q.id].feedback.trim() !== ""
              ? perQ[r.q.id].feedback
              : null,
        };
      });

      const result = await gradeTestSubmission({
        submissionId,
        score: effectiveScore,
        outOf: outOfTotal,
        feedback:
          overallFeedback.trim() === "" ? null : overallFeedback,
        questionGrades,
      });
      if (result?.serverError) throw new Error(result.serverError);
      toast.success(`Saved grade for ${studentName}`);
      router.push(`/dashboard/tutor-tests/${testId}/submissions`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setPending(false);
    }
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-6 pb-40">
      {rows.map((r) => (
        <QuestionCard
          key={r.q.id}
          row={r}
          answer={answers[r.q.id]}
          score={perQ[r.q.id]?.score ?? ""}
          feedback={perQ[r.q.id]?.feedback ?? ""}
          onScore={(v) => updateScore(r.q.id, v)}
          onFeedback={(v) => updateFeedback(r.q.id, v)}
          onAssignFull={() => assignFull(r.q.id, r.q.points)}
        />
      ))}

      <Card className="space-y-3 p-6">
        <div>
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Overall feedback
          </h2>
          <p className="text-muted-foreground text-sm">
            Optional. Rendered with markdown + MathJax on the student review.
          </p>
        </div>
        <Textarea
          rows={6}
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="Nice work overall. A few notes..."
        />
      </Card>

      {/* Sticky save bar */}
      <div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Overall</p>
              <div className="flex items-baseline gap-2">
                <Input
                  type="number"
                  className="h-9 w-20 text-right tabular-nums"
                  value={overrideOverall ?? String(scoreSum)}
                  onChange={(e) => setOverrideOverall(e.target.value)}
                  min={0}
                />
                <span className="text-muted-foreground text-sm tabular-nums">
                  / {outOfTotal}
                </span>
                {outOfTotal > 0 && (
                  <Badge
                    variant={overallPct >= 50 ? "soft" : "secondary"}
                    className="tabular-nums"
                  >
                    {overallPct}%
                  </Badge>
                )}
              </div>
            </div>
            {overrideOverall != null && overrideOverall !== String(scoreSum) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOverrideOverall(null)}
                className="text-muted-foreground"
              >
                Use sum ({scoreSum})
              </Button>
            )}
            {!allGraded && (
              <span className="text-muted-foreground text-xs">
                Some questions still ungraded — score defaults to 0 for those.
              </span>
            )}
          </div>
          <Button type="button" variant="brand" onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {existingGrade ? "Update grade" : "Save grade"}
            <Save className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* QuestionCard                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function QuestionCard({
  row,
  answer,
  score,
  feedback,
  onScore,
  onFeedback,
  onAssignFull,
}: {
  row: FlatRow;
  answer: unknown;
  score: string;
  feedback: string;
  onScore: (v: string) => void;
  onFeedback: (v: string) => void;
  onAssignFull: () => void;
}) {
  const { q, path, depth, gradable } = row;
  const isContext = !gradable;

  return (
    <Card
      className={cn(
        "space-y-4 p-6",
        depth > 0 && "border-brand-terracotta/30 ml-6",
      )}
    >
      <div className="space-y-2">
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            isContext ? "text-muted-foreground" : "text-brand-terracotta",
          )}
        >
          {isContext
            ? `Context ${path}`
            : `Question ${path} · ${q.points} ${q.points === 1 ? "point" : "points"}`}
        </p>
        <LessonMarkdown content={q.question} />
      </div>

      {!isContext && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                Student answer
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
                <AnswerView type={q.type} value={answer} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700">
                Correct answer
              </p>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                <CorrectAnswerView q={q} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">
                Score
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-9 w-20 text-right tabular-nums"
                  value={score}
                  onChange={(e) => onScore(e.target.value)}
                  min={0}
                  max={q.points}
                  placeholder="0"
                />
                <span className="text-muted-foreground text-sm tabular-nums">
                  / {q.points}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAssignFull}
                  title="Give full marks"
                  className="text-brand-terracotta"
                >
                  <CheckCircle2 className="size-3.5" />
                  Full
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">
                Feedback
              </label>
              <Textarea
                rows={3}
                value={feedback}
                onChange={(e) => onFeedback(e.target.value)}
                placeholder="Optional — markdown + LaTeX supported."
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* AnswerView — mirrors the read-only renderer on the grade review page.     */
/* ──────────────────────────────────────────────────────────────────────── */

function AnswerView({ type, value }: { type: string; value: unknown }) {
  const empty =
    value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (empty) {
    return (
      <p className="text-muted-foreground italic text-xs">No answer recorded.</p>
    );
  }
  const wrap = (body: React.ReactNode) => (
    <div className="bg-muted/40 rounded-md border border-border p-3 text-sm">
      {body}
    </div>
  );

  switch (type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
      return wrap(<p className="text-foreground">{String(value)}</p>);
    case "ESSAY":
    case "CODE":
      return wrap(
        <div
          className={
            type === "CODE"
              ? "font-mono whitespace-pre-wrap text-xs text-foreground"
              : "whitespace-pre-wrap text-foreground"
          }
        >
          {String(value)}
        </div>,
      );
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ul className="list-disc pl-5 text-foreground">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ul>,
      );
    }
    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {arr.map((v, i) => (
            <li key={i}>{v || <span className="text-muted-foreground italic">blank</span>}</li>
          ))}
        </ol>,
      );
    }
    case "REORDER": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {arr.map((v, i) => <li key={i}>{v}</li>)}
        </ol>,
      );
    }
    case "MATCHING": {
      const arr = Array.isArray(value)
        ? (value as Array<{ left: string; right: string }>)
        : [];
      return wrap(
        <ul className="space-y-1 text-foreground">
          {arr.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.left}</span>
              <span className="text-muted-foreground"> → </span>
              <span>{p.right}</span>
            </li>
          ))}
        </ul>,
      );
    }
    case "FILE_UPLOAD": {
      const v = value as { fileUrl?: string; fileName?: string } | null;
      if (!v?.fileUrl) {
        return wrap(
          <p className="text-muted-foreground italic text-xs">No file uploaded.</p>,
        );
      }
      return wrap(
        <a
          href={v.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand-terracotta inline-flex items-center gap-1 hover:underline"
        >
          <FileText className="size-3" />
          {v.fileName ?? "View file"}
          <ExternalLink className="size-3" />
        </a>,
      );
    }
    default:
      return wrap(
        <pre className="whitespace-pre-wrap text-xs text-foreground">
          {JSON.stringify(value, null, 2)}
        </pre>,
      );
  }
}



/* ─── CorrectAnswerView — tutor-side key display ─────────────────────── */

function CorrectAnswerView({ q }: { q: GradingQuestion }) {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC": {
      const val = q.correctAnswer;
      if (val == null || (typeof val === "string" && val.trim() === "")) {
        return (
          <p className="text-muted-foreground italic text-xs">
            No key set — grade manually.
          </p>
        );
      }
      return (
        <div className="text-foreground text-sm">
          <LessonMarkdown content={String(val)} className="prose-sm" />
        </div>
      );
    }
    case "MULTI_SELECT": {
      const arr = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ul className="text-foreground text-sm list-disc pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>
              <LessonMarkdown content={v} className="prose-sm" />
            </li>
          ))}
        </ul>
      );
    }
    case "FILL_IN_THE_BLANK": {
      const arr = Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]) : [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ol>
      );
    }
    case "REORDER": {
      const arr = q.reorderItems ?? [];
      if (arr.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No key set.</p>;
      }
      return (
        <ol className="text-foreground text-sm list-decimal pl-5 space-y-0.5">
          {arr.map((v, i) => (
            <li key={i}>
              <LessonMarkdown content={v} className="prose-sm" />
            </li>
          ))}
        </ol>
      );
    }
    case "MATCHING": {
      const pairs = (q.matchPairs ?? []) as Array<{ left: string; right: string }>;
      if (pairs.length === 0) {
        return <p className="text-muted-foreground italic text-xs">No pairs set.</p>;
      }
      return (
        <ul className="text-foreground text-sm space-y-1">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0">
                <LessonMarkdown content={p.left} className="prose-sm" />
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="min-w-0">
                <LessonMarkdown content={p.right} className="prose-sm" />
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "ESSAY":
    case "CODE":
    case "FILE_UPLOAD":
    case "NONE":
      return (
        <p className="text-muted-foreground italic text-xs">
          Subjective — no fixed key. Grade using your own criteria.
        </p>
      );
    default:
      return null;
  }
}
