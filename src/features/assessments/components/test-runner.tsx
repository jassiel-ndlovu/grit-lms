"use client";

/**
 * TestRunner — student-facing client island that proctors a test session.
 *
 * Question tree handling:
 *   The TestQuestion model uses a parentId self-relation. A "parent"
 *   question is typically a passage / context block; children are
 *   individually-gradable items. Both can be answered, so the runner
 *   walks the full tree depth-first and treats every node as a step. When
 *   the current step has a parentId we render the parent question text as
 *   a separate "Context" card above the input so the student keeps the
 *   prompt in view across sub-questions. The sidebar grid uses a 1-based
 *   sequential numbering across the flattened list so jumps stay simple.
 *
 * Behaviour:
 *   - Owns answer state per questionId. Persists periodically to the
 *     server via the saveTestAnswersDraft action (debounced ~3s) so
 *     accidental refreshes don't lose work.
 *   - Computes timeRemaining from `startedAt + timeLimit*60s`. When the
 *     timer hits zero the runner auto-submits the current answer set
 *     (no user confirmation - the legacy semantic).
 *   - Online/offline indicator next to the timer so the student knows
 *     drafts may not be persisting if connection drops.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Save, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  saveTestAnswersDraft,
  submitTestAnswers,
} from "../actions";
import { QuestionRenderer, type RendererQuestion } from "./question-renderer";

/**
 * Question shape consumed by the runner. The page wrapper flattens the
 * tree depth-first and annotates each row with `depth` (0 for top-level,
 * 1 for direct sub-question, etc.) plus an optional `parentText` so the
 * runner doesn't have to re-resolve the parent on every render.
 *
 * `displayLabel` is the dotted path the sidebar uses, e.g. "1", "1.a",
 * "1.b", "2" — built once on the server.
 */
export interface RunnerQuestion extends RendererQuestion {
  parentId: string | null;
  order: number | null;
  depth: number;
  /** Pre-resolved text of the parent question, if any. */
  parentText: string | null;
  /** Pre-rendered numeric/dotted label for the sidebar (e.g. "1", "1.a"). */
  displayLabel: string;
}

export interface TestRunnerProps {
  testId: string;
  submissionId: string;
  /** Test title for the header. */
  title: string;
  /** Every question in the test, flattened depth-first by the page wrapper. */
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
        toast.success(auto ? "Time up — submitted automatically" : "Test submitted");
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
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  const lowOnTime =
    timeRemaining != null && timeRemaining <= 60 && timeRemaining > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      {/* ───── Main pane ───── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs">
              Question {current.displayLabel} of {questions.length} ·{" "}
              {current.points} {current.points === 1 ? "point" : "points"}
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
              title={online ? "Online" : "Offline — drafts will retry on reconnect"}
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

        {/* Parent context — only present when current is a sub-question. */}
        {current.parentText && (
          <Card className="bg-muted/40 space-y-2 p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Context
            </p>
            <p className="text-foreground whitespace-pre-wrap text-sm">
              {current.parentText}
            </p>
          </Card>
        )}

        <Card className="space-y-5 p-6">
          {current.depth > 0 && (
            <p className="text-brand-terracotta text-xs font-medium tabular-nums">
              Sub-question {current.displayLabel}
            </p>
          )}
          <p className="text-foreground whitespace-pre-wrap text-sm font-medium">
            {current.question}
          </p>
          <QuestionRenderer
            question={current}
            value={answers[current.id]}
            onChange={(v) => updateAnswer(current.id, v)}
            disabled={submitting || timeRemaining === 0}
            testId={testId}
          />
        </Card>

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

      {/* ───── Sidebar (question grid) ───── */}
      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-sm leading-tight text-foreground">
              Questions
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {questions.map((q, i) => {
              const answered = isAnswered(answers[q.id]);
              const active = i === currentIdx;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    disabled={submitting}
                    style={{ paddingLeft: `${0.5 + q.depth * 0.75}rem` }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-xs transition-colors",
                      active
                        ? "bg-brand-terracotta/10 text-foreground ring-1 ring-brand-terracotta/40"
                        : answered
                          ? "text-foreground hover:bg-muted/40"
                          : "text-muted-foreground hover:bg-muted/40",
                    )}
                    aria-label={`Go to question ${q.displayLabel}${answered ? " (answered)" : ""}`}
                  >
                    {answered ? (
                      <CheckCircle2
                        className={cn(
                          "size-3.5 shrink-0",
                          active ? "text-brand-terracotta" : "text-brand-terracotta/70",
                        )}
                      />
                    ) : (
                      <Circle className="size-3.5 shrink-0 opacity-50" />
                    )}
                    <span className="tabular-nums w-8 shrink-0 font-medium">
                      {q.displayLabel}
                    </span>
                    <span className="truncate flex-1">{q.question}</span>
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
