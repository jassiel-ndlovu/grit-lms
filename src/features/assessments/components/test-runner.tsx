"use client";

/**
 * TestRunner — student-facing client island that proctors a test session.
 *
 * Tree handling:
 *   The TestQuestion model uses a parentId self-relation. A parent question
 *   either accepts an answer (any normal QuestionType) OR acts as pure
 *   context for its children (type === "NONE"). Sub-questions are always
 *   answerable.
 *
 *   Each navigable step in the runner is a TOP-LEVEL question. When the
 *   step has children we render them stacked inline beneath the parent,
 *   each with its own input. The student writes one answer per question
 *   regardless of nesting; the runner stores them in a flat record keyed
 *   by questionId.
 *
 * Behaviour:
 *   - Owns answer state per questionId. Persists periodically via
 *     saveTestAnswersDraft (debounced ~3s) so refresh doesn't lose work.
 *   - Computes timeRemaining from `startedAt + timeLimit*60s`. Auto-submits
 *     at zero (no user confirmation - legacy semantic).
 *   - Online/offline indicator next to the timer.
 *   - Sidebar lists top-level questions with a "X parts" subtitle when a
 *     parent has sub-questions. Click jumps directly to that step.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Save, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import LessonMarkdown from "@/app/components/markdown";

import {
  saveTestAnswersDraft,
  submitTestAnswers,
} from "../actions";
import { QuestionRenderer, type RendererQuestion } from "./question-renderer";

/**
 * Question shape consumed by the runner. Top-level questions carry an
 * embedded `subQuestions` array (typed recursively); leaf questions just
 * have an empty array. The page wrapper builds this shape from Prisma's
 * `include: { subQuestions: true }` payload.
 */
export interface RunnerQuestion extends RendererQuestion {
  parentId: string | null;
  order: number | null;
  /** Always present — empty array when there are no children. */
  subQuestions: RunnerQuestion[];
}

export interface TestRunnerProps {
  testId: string;
  submissionId: string;
  title: string;
  /** Top-level questions only. Children live on `subQuestions`. */
  questions: RunnerQuestion[];
  /** Restored answer state from a previous session (or empty object). */
  initialAnswers: Record<string, unknown>;
  /** Time limit in minutes, or null for untimed. */
  timeLimit: number | null;
  /** When the submission was created — anchors the countdown. */
  startedAt: Date;
}

const SAVE_DEBOUNCE_MS = 3000;

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** Walk a top-level question + its sub-questions, calling f on each. */
function forEachAnswerable(
  q: RunnerQuestion,
  f: (q: RunnerQuestion) => void,
): void {
  // NONE-typed questions don't accept an answer; skip them in counts.
  if ((q.type as string) !== "NONE") f(q);
  for (const child of q.subQuestions) forEachAnswerable(child, f);
}

export function TestRunner({
  testId,
  submissionId,
  title,
  questions,
  initialAnswers,
  timeLimit,
  startedAt,
}: TestRunnerProps) {
  const router = useRouter();

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(initialAnswers);
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [now, setNow] = React.useState(() => Date.now());

  const answersRef = React.useRef(answers);
  answersRef.current = answers;

  /* ───── Online/offline ───── */
  React.useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    function up() { setOnline(true); }
    function down() { setOnline(false); }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  /* ───── Timer tick (1s) ───── */
  React.useEffect(() => {
    if (timeLimit == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timeLimit]);

  const timeRemaining = React.useMemo(() => {
    if (timeLimit == null) return null;
    const elapsedSec = Math.floor((now - startedAt.getTime()) / 1000);
    return Math.max(0, timeLimit * 60 - elapsedSec);
  }, [now, startedAt, timeLimit]);

  /* ───── Debounced draft save ───── */
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (submitting) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const result = await saveTestAnswersDraft({
          submissionId,
          answers: answersRef.current,
        });
        if (result?.serverError) {
          console.warn("[TestRunner] draft save failed:", result.serverError);
        }
      } catch {
        /* best-effort */
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, submissionId, submitting]);

  /* ───── Submission ───── */
  const onSubmit = React.useCallback(
    async (auto: boolean = false) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const result = await submitTestAnswers({
          submissionId,
          answers: answersRef.current,
        });
        if (result?.serverError) throw new Error(result.serverError);
        toast.success(auto ? "Time up - submitted automatically" : "Test submitted");
        router.push(`/dashboard/tests/review/${testId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Submission failed");
        setSubmitting(false);
      }
    },
    [submissionId, router, testId, submitting],
  );

  /* ───── Auto-submit on time expiry ───── */
  React.useEffect(() => {
    if (timeRemaining === 0 && !submitting) {
      void onSubmit(true);
    }
  }, [timeRemaining, submitting, onSubmit]);

  function updateAnswer(questionId: string, next: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
  }

  if (questions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h2 className="font-display text-xl text-foreground">No questions yet</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This test doesn&apos;t have any questions published. Check back later.
        </p>
      </Card>
    );
  }

  const current = questions[currentIdx];

  // Aggregate answered/total across the full tree (parents + sub-questions,
  // skipping NONE-typed parents which don't take answers).
  let totalAnswerable = 0;
  let totalAnswered = 0;
  for (const q of questions) {
    forEachAnswerable(q, (node) => {
      totalAnswerable += 1;
      if (isAnswered(answers[node.id])) totalAnswered += 1;
    });
  }

  const lowOnTime =
    timeRemaining != null && timeRemaining <= 60 && timeRemaining > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      {/* ───── Main pane ───── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs">
              Question {currentIdx + 1} of {questions.length}
            </p>
            <h1 className="font-display mt-1 text-xl leading-tight tracking-tight text-foreground">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                online ? "text-muted-foreground" : "text-destructive",
              )}
              title={online ? "Online" : "Offline - drafts will retry on reconnect"}
            >
              {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
              {online ? "Online" : "Offline"}
            </span>
            {saving && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Save className="size-3" /> Saving
              </span>
            )}
            {timeRemaining != null && (
              <Badge
                variant={lowOnTime ? "destructive" : "soft"}
                className="tabular-nums"
              >
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
        </div>

        <QuestionView
          question={current}
          path={String(currentIdx + 1)}
          answers={answers}
          onAnswer={updateAnswer}
          disabled={submitting || timeRemaining === 0}
          testId={testId}
        />

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={submitting || currentIdx === 0}
          >
            ← Previous
          </Button>

          {currentIdx < questions.length - 1 ? (
            <Button
              type="button"
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={submitting}
            >
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              variant="brand"
              onClick={() => onSubmit(false)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Submit test
            </Button>
          )}
        </div>
      </div>

      {/* ───── Sidebar (question list) ───── */}
      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-sm leading-tight text-foreground">
              Questions
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {totalAnswered}/{totalAnswerable}
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {questions.map((q, i) => {
              const active = i === currentIdx;
              // A top-level row is "complete" when every answerable node in
              // its sub-tree has an answer.
              let groupTotal = 0;
              let groupDone = 0;
              forEachAnswerable(q, (node) => {
                groupTotal += 1;
                if (isAnswered(answers[node.id])) groupDone += 1;
              });
              const allDone = groupTotal > 0 && groupDone === groupTotal;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    disabled={submitting}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                      active
                        ? "bg-brand-terracotta/10 text-foreground ring-1 ring-brand-terracotta/40"
                        : allDone
                          ? "text-foreground hover:bg-muted/40"
                          : "text-muted-foreground hover:bg-muted/40",
                    )}
                    aria-label={`Go to question ${i + 1}${allDone ? " (complete)" : ""}`}
                  >
                    {allDone ? (
                      <CheckCircle2
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          active ? "text-brand-terracotta" : "text-brand-terracotta/70",
                        )}
                      />
                    ) : (
                      <Circle className="mt-0.5 size-3.5 shrink-0 opacity-50" />
                    )}
                    <span className="tabular-nums w-5 shrink-0 font-medium">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{q.question}</span>
                      {q.subQuestions.length > 0 && (
                        <span className="text-muted-foreground/80 mt-0.5 block text-[11px] tabular-nums">
                          {groupDone}/{groupTotal} parts
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-4">
          <p className="text-muted-foreground text-xs">
            Drafts auto-save every {SAVE_DEBOUNCE_MS / 1000} seconds.
          </p>
        </Card>
      </aside>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* QuestionView                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Renders a single question card. When the question is a parent with
 * sub-questions, each child renders as a stacked card beneath the parent,
 * recursively. The parent itself only gets an input when its type !== NONE.
 */
function QuestionView({
  question,
  path,
  answers,
  onAnswer,
  disabled,
  testId,
}: {
  question: RunnerQuestion;
  /** Display path (e.g. "1", "1.a") used as a small caption above the input. */
  path: string;
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, next: unknown) => void;
  disabled?: boolean;
  testId: string;
}) {
  const isContext = (question.type as string) === "NONE";
  const hasChildren = question.subQuestions.length > 0;

  return (
    <Card className={cn("space-y-5 p-6", question.parentId && "border-brand-terracotta/30")}>
      <div className="space-y-2">
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            isContext ? "text-muted-foreground" : "text-brand-terracotta",
          )}
        >
          {isContext
            ? `Context ${path}`
            : `Question ${path} - ${question.points} ${question.points === 1 ? "point" : "points"}`}
        </p>
        <LessonMarkdown content={question.question} />
      </div>

      {!isContext && (
        <QuestionRenderer
          question={question}
          value={answers[question.id]}
          onChange={(v) => onAnswer(question.id, v)}
          disabled={disabled}
          testId={testId}
        />
      )}

      {hasChildren && (
        <div className="space-y-4 border-l-2 border-brand-terracotta/20 pl-4 sm:pl-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Parts ({question.subQuestions.length})
          </p>
          {question.subQuestions.map((child, i) => {
            // Sub-question path uses lettered labels at depth 1 ("1.a"),
            // numeric beyond. Depth is just path-segment count.
            const childPath = nextPath(path, i, depthOf(path));
            return (
              <QuestionView
                key={child.id}
                question={child}
                path={childPath}
                answers={answers}
                onAnswer={onAnswer}
                disabled={disabled}
                testId={testId}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Build a child label given the parent path and current depth. */
function nextPath(parentPath: string, childIdx: number, parentDepth: number): string {
  const segment =
    parentDepth === 0
      ? (SUB_LETTERS[childIdx % SUB_LETTERS.length] ?? String(childIdx + 1))
      : String(childIdx + 1);
  return `${parentPath}.${segment}`;
}

/** Depth = how many separators are in the path so far ("1" = 0, "1.a" = 1). */
function depthOf(path: string): number {
  return path.split(".").length - 1;
}
