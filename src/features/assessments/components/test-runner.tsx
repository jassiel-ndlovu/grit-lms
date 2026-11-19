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
 *   Each navigable step in the runner is a TOP-LEVEL question, shown one per
 *   screen (owner decision 8). When the step has children we render them
 *   stacked inline beneath the parent, each with its own input. Answers are
 *   a flat record keyed by questionId.
 *
 * Layout (b/research/05 "Test runner", 06 §3):
 *   - One header: the title, save status, the clock, Save and Submit. In a
 *     sitting it sticks to the top; the route has no sidebar (AppShell's
 *     focus routes), so "Save and exit" is the only way out.
 *   - Under it, the question strip: a button per step whose name spells
 *     out its state ("Question 3, partly answered, 1 of 2 parts, flagged"),
 *     drawn with fill, a corner flag and an error icon, not colour alone.
 *   - Flag for review belongs to the student and is kept in this browser.
 *   - Submit opens a summary listing unanswered and flagged questions.
 *   - The clock reads out at 5 minutes and 1 minute left.
 *   - Alt+↑/↓ move between questions, Alt+F flags, Ctrl/Cmd+S saves.
 *
 * Behaviour:
 *   - Persists answers via saveTestAnswersDraft (debounced, with a max-wait
 *     ceiling, flushed on navigation and when the tab is hidden). A failed
 *     save marks the steps whose answers it carried as "not saved".
 *   - Counts down to the earlier of `startedAt + timeLimit` and the due
 *     date. Auto-submits at zero (no confirmation - legacy semantic).
 *
 * Modes:
 *   "student" (default) - the real sitting. Drafts autosave, the timer
 *     auto-submits at zero, Submit finalises the attempt.
 *   "preview" - a tutor checking their own test. Same component, same
 *     renderers, same layout, so what they see is what students get.
 *     Nothing autosaves; the timer counts down for realism but never
 *     submits; and the answers the tutor gives are saved as the test's
 *     ANSWER KEY rather than as an attempt.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, Flag, Loader2, LogOut, Save, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import LessonMarkdown from "@/app/components/markdown";

import {
  saveTestAnswerKey,
  saveTestAnswersDraft,
  submitTestAnswers,
} from "../actions";
import { QuestionRenderer, type RendererQuestion } from "./question-renderer";
import { labelTree, normalizeScheme } from "@/lib/enum-labels";
import { attemptDeadline } from "../lib/attempt-deadline";
import {
  flagStorageKey,
  runnerKey,
  stepName,
  summariseStep,
  timerWarning,
  unansweredLabels,
  type StepSummary,
} from "../lib/runner-state";

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

export type RunnerMode = "student" | "preview";

export interface TestRunnerProps {
  testId: string;
  /** The attempt being written to. Omitted in preview - nothing is saved to one. */
  submissionId?: string;
  title: string;
  /** Top-level questions only. Children live on `subQuestions`. */
  questions: RunnerQuestion[];
  /** Restored answer state from a previous session (or empty object). */
  initialAnswers: Record<string, unknown>;
  /** Time limit in minutes, or null for untimed. */
  timeLimit: number | null;
  /** When the submission was created - anchors the countdown. */
  startedAt: Date;
  /** The test's due date. The attempt closes at the earlier of this and
   *  startedAt + timeLimit (see lib/attempt-deadline.ts). */
  dueDate?: Date | null;
  /** Defaults to "student". See the mode notes at the top of this file. */
  mode?: RunnerMode;
  /** The test's question numbering (Test.labelScheme); empty = default. */
  labelScheme?: string[];
  /** Where "Save and exit" goes (a sitting only). Omit to hide the button. */
  exitHref?: string;
  /** Sticky offset classes for the header in a sitting. Default "top-0"
   *  (the revamp shell has no top bar on this route). */
  stickyTop?: string;
}

// Shorter debounce = quicker recovery from accidental refreshes.
// MAX_WAIT_MS is the ceiling: if the user has been typing continuously
// (essay questions, code answers) for this long, we force a save even
// though the debounce hasn't settled yet.
const SAVE_DEBOUNCE_MS = 1200;
const SAVE_MAX_WAIT_MS = 15000;

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Untimed tests only show the clock once the due date is this close. */
const SHOW_DUE_CLOCK_WITHIN_S = 3 * 3600;

/** How many unanswered labels the submit summary lists before "and N more". */
const SUMMARY_LIMIT = 12;

export function TestRunner({
  testId,
  submissionId,
  title,
  questions,
  initialAnswers,
  timeLimit,
  startedAt,
  dueDate,
  mode = "student",
  labelScheme,
  exitHref,
  stickyTop = "top-0",
}: TestRunnerProps) {
  const labels = React.useMemo(
    () => labelTree(questions, normalizeScheme(labelScheme), (q) => q.id, (q) => q.subQuestions),
    [questions, labelScheme],
  );
  const router = useRouter();
  const preview = mode === "preview";

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(initialAnswers);
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  // Last draft-save outcome. Draft saves used to fail silently into
  // console.warn, so a student whose work wasn't persisting had no way to
  // know until they reloaded and found it gone.
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Question ids whose latest answer no save has stored yet, after a save
  // failed. Drawn on the strip as "not saved".
  const [unsavedIds, setUnsavedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  // Ids changed since the last save started.
  const pendingRef = React.useRef<Set<string>>(new Set());
  // Flagged top-level question ids (the student's own "come back to this").
  const [flagged, setFlagged] = React.useState<ReadonlySet<string>>(() => new Set());
  // Preview-only: the tutor has changed an answer since the last explicit
  // save. Used to warn before navigating away, since nothing autosaves.
  const [dirty, setDirty] = React.useState(false);
  // Manual submit asks first; only the timer submits without confirming.
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // The clock lives in <Countdown>, not here. Holding `now` in this
  // component re-rendered the entire question tree every second, which on
  // maths-heavy tests made typing lag further and further behind.
  // The attempt ends at the earlier of the time limit and the due date -
  // the same rule the auto-submit cron uses, so the clock can't show time
  // the server won't honour.
  const end = preview
    ? null
    : attemptDeadline({ startedAt, timeLimit, dueDate: dueDate ?? null });
  const deadline = end?.at ?? null;
  const [expired, setExpired] = React.useState(
    () => deadline != null && Date.now() >= deadline,
  );
  const onExpire = React.useCallback(() => setExpired(true), []);

  const answersRef = React.useRef(answers);
  answersRef.current = answers;

  // Timestamp of the last successful save. Used by the debounce effect to
  // enforce SAVE_MAX_WAIT_MS so a continuously-typing student never goes
  // longer than that window without a save.
  const lastSavedAtRef = React.useRef<number>(Date.now());

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

  /* ───── Flags, kept in this browser for this attempt ───── */
  const flagsLoaded = React.useRef(false);
  React.useEffect(() => {
    if (preview || !submissionId) return;
    try {
      const raw = window.localStorage.getItem(flagStorageKey(submissionId));
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(ids)) {
        const known = new Set(questions.map((q) => q.id));
        setFlagged(new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id))));
      }
    } catch {
      // Storage blocked or bad JSON: start with no flags.
    }
    flagsLoaded.current = true;
  }, [preview, submissionId, questions]);
  React.useEffect(() => {
    if (preview || !submissionId || !flagsLoaded.current) return;
    try {
      window.localStorage.setItem(flagStorageKey(submissionId), JSON.stringify([...flagged]));
    } catch {
      // Flags are a convenience; losing them on a full or blocked store is fine.
    }
  }, [flagged, preview, submissionId]);

  /* ───── Draft persistence ─────
      Single writer used by the debounce, the nav flush, and the explicit
      Save button, so every path reports failures the same way. */
  const persistDraft = React.useCallback(async () => {
    // Preview has no attempt to write to, and a half-typed memo shouldn't
    // reach the database on a timer - the tutor saves the key explicitly.
    if (preview || !submissionId) return;
    // Every save sends the whole record, so success stores everything sent.
    const sending = new Set(pendingRef.current);
    pendingRef.current.clear();
    const fail = (message: string) => {
      console.warn("[TestRunner] draft save failed:", message);
      setSaveError(message);
      for (const id of sending) pendingRef.current.add(id);
      setUnsavedIds((prev) => new Set([...prev, ...sending]));
    };
    setSaving(true);
    try {
      const result = await saveTestAnswersDraft({
        submissionId,
        answers: answersRef.current,
      });
      const message =
        result?.serverError ??
        (result?.validationErrors ? "Answer format rejected by the server" : null);
      if (message) {
        fail(message);
      } else {
        lastSavedAtRef.current = Date.now();
        setSaveError(null);
        setUnsavedIds(new Set());
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [submissionId, preview]);

  /* ───── Debounced draft save (with max-wait ceiling) ───── */
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (submitting) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    // If the user has been changing answers for longer than the max-wait
    // ceiling without a successful save, fire immediately instead of
    // waiting for the debounce to settle. This catches long-form answers
    // (essays / code) where continuous typing would otherwise starve the
    // debounce indefinitely.
    const elapsed = Date.now() - lastSavedAtRef.current;
    const delay =
      elapsed >= SAVE_MAX_WAIT_MS ? 0 : SAVE_DEBOUNCE_MS;

    saveTimer.current = setTimeout(() => {
      void persistDraft();
    }, delay);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, submitting, persistDraft]);

  /* ───── Save on tab hidden / page unload ───── */
  React.useEffect(() => {
    function flushOnHide() {
      if (submitting) return;
      // Fire-and-forget; the browser may kill the request but this is best
      // we can do without a Service Worker.
      void persistDraft();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushOnHide();
    }
    // In preview there is nothing to flush; instead warn about unsaved
    // work, because the tutor's answers only reach the database on Save.
    function warnUnsaved(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }

    if (preview) {
      window.addEventListener("beforeunload", warnUnsaved);
      return () => window.removeEventListener("beforeunload", warnUnsaved);
    }

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", flushOnHide);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", flushOnHide);
    };
  }, [submitting, persistDraft, preview, dirty]);

  /* ───── Flush save (immediate, used by nav) ───── */
  const saveNow = React.useCallback(async () => {
    // Cancel any pending debounced save so we don't double-fire after.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await persistDraft();
  }, [persistDraft]);

  /* ───── Submission ───── */
  const onSubmit = React.useCallback(
    async (auto: boolean = false) => {
      if (submitting) return;
      setSubmitting(true);

      // Preview: the tutor's answers are the memo, not an attempt.
      if (preview) {
        try {
          const result = await saveTestAnswerKey({
            testId,
            answers: answersRef.current,
          });
          if (result?.serverError) throw new Error(result.serverError);
          if (result?.validationErrors) {
            throw new Error("Some answers were rejected. Check the values and retry.");
          }
          const n = result?.data?.updated ?? 0;
          toast.success(
            n === 0
              ? "Nothing to save yet - answer a question first."
              : `Answer key saved for ${n} ${n === 1 ? "question" : "questions"}.`,
          );
          setDirty(false);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save the answer key");
        } finally {
          setSubmitting(false);
        }
        return;
      }

      if (!submissionId) {
        toast.error("No attempt to submit.");
        setSubmitting(false);
        return;
      }

      try {
        const result = await submitTestAnswers({
          submissionId,
          answers: answersRef.current,
        });
        if (result?.serverError) throw new Error(result.serverError);
        try {
          window.localStorage.removeItem(flagStorageKey(submissionId));
        } catch {
          // Nothing to tidy if storage is blocked.
        }
        toast.success(auto ? "Time up - submitted automatically" : "Test submitted");
        router.push(`/dashboard/tests/review/${testId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Submission failed");
        setSubmitting(false);
      }
    },
    [submissionId, router, testId, submitting, preview],
  );

  /* ───── Auto-submit on time expiry ───── */
  React.useEffect(() => {
    // The countdown runs in preview so the tutor can see it, but it must
    // never fire - there is no attempt to submit and no student waiting.
    if (preview) return;
    if (expired && !submitting) {
      void onSubmit(true);
    }
  }, [expired, submitting, onSubmit, preview]);

  /** Submit buttons route through here: students confirm, preview saves. */
  const requestSubmit = React.useCallback(() => {
    if (submitting) return;
    if (preview) void onSubmit(false);
    else setConfirmOpen(true);
  }, [submitting, preview, onSubmit]);

  const updateAnswer = React.useCallback(
    (questionId: string, next: unknown) => {
      pendingRef.current.add(questionId);
      setAnswers((prev) => ({ ...prev, [questionId]: next }));
      if (preview) setDirty(true);
    },
    [preview],
  );

  /** Save, then show step `i`, optionally scrolled to one of its parts. */
  const goTo = React.useCallback(
    async (i: number, targetId?: string) => {
      if (i < 0 || i >= questions.length) return;
      // Flush first so the student never loses what they just typed.
      await saveNow();
      setCurrentIdx(i);
      requestAnimationFrame(() => {
        const el = targetId ? document.getElementById(questionAnchor(targetId)) : null;
        if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [questions.length, saveNow],
  );

  const current = questions[currentIdx];
  const toggleFlag = React.useCallback(() => {
    if (!current) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  }, [current]);

  /* ───── Shortcuts ───── */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = runnerKey(e);
      if (!k || submitting) return;
      e.preventDefault();
      if (k === "next") void goTo(currentIdx + 1);
      else if (k === "prev") void goTo(currentIdx - 1);
      else if (k === "flag") toggleFlag();
      else if (k === "save" && !preview) void saveNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, currentIdx, toggleFlag, saveNow, submitting, preview]);

  if (!current) {
    return (
      <Card className="p-8 sm:p-12 text-center">
        <h2 className="font-display text-xl text-foreground">No questions yet</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This test doesn&apos;t have any questions published. Check back later.
        </p>
      </Card>
    );
  }

  const steps = questions.map((q) => summariseStep(q, answers, flagged, unsavedIds));
  let totalAnswerable = 0;
  let totalAnswered = 0;
  for (const s of steps) {
    totalAnswerable += s.total;
    totalAnswered += s.answered;
  }
  const unanswered = unansweredLabels(questions, answers, labels);
  const flaggedSteps = questions
    .map((q, i) => ({ i, id: q.id, label: labels.get(q.id) ?? String(i + 1) }))
    .filter((s) => flagged.has(s.id));
  const currentLabel = labels.get(current.id) ?? String(currentIdx + 1);
  const isFlagged = flagged.has(current.id);
  const last = currentIdx === questions.length - 1;

  return (
    <div className="space-y-5">
      {preview && (
        <div className="border-brand-terracotta/40 bg-brand-terracotta/8 flex flex-wrap items-start gap-2 rounded-md border p-3">
          <Eye className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
          <p className="text-foreground text-xs leading-relaxed">
            <span className="font-medium">Preview.</span> This is exactly
            what students see. Answers you give here are saved as the
            answer key for this test - the memo their work is marked
            against. Nothing autosaves; press{" "}
            <span className="font-medium">Save answer key</span> when
            you&apos;re done.
          </p>
        </div>
      )}

      {/* The header and the question strip. In a sitting they stick to the
          top of the window together. */}
      <div
        className={cn(
          "bg-background/95 border-border z-20 -mx-4 border-b px-4 backdrop-blur sm:-mx-6 sm:px-6",
          !preview && cn("sticky", stickyTop),
        )}
      >
        <div className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 py-2">
          <h1 className="font-display text-foreground min-w-0 basis-full truncate text-base leading-tight tracking-tight sm:flex-1 sm:basis-auto sm:text-lg">
            {title}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!preview && !online && (
              <span
                className="text-destructive inline-flex items-center gap-1 text-xs"
                title="Offline - answers save again when you reconnect"
              >
                <WifiOff className="size-3" aria-hidden />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
            {preview && dirty && (
              <span className="text-muted-foreground text-xs">Unsaved</span>
            )}
            {saving ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Save className="size-3" aria-hidden /> <span className="hidden sm:inline">Saving</span>
              </span>
            ) : saveError ? (
              <span
                className="text-destructive inline-flex items-center gap-1 text-xs"
                title={`Last save failed: ${saveError}`}
              >
                <AlertTriangle className="size-3" aria-hidden /> Not saved
              </span>
            ) : null}
            {preview && timeLimit != null && (
              <Badge
                variant="soft"
                className="tabular-nums"
                title="How long students get. The clock doesn't run in preview."
              >
                {formatTime(timeLimit * 60)} limit
              </Badge>
            )}
            {deadline != null && (
              <Countdown
                deadline={deadline}
                onExpire={onExpire}
                alwaysShow={timeLimit != null}
                cutShort={end?.cutShort ?? false}
              />
            )}
            {!preview && exitHref && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting || saving}
                title="Save your answers and leave. The clock keeps running."
                onClick={async () => {
                  await saveNow();
                  router.push(exitHref);
                }}
              >
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Save and exit</span>
              </Button>
            )}
            {!preview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveNow}
                disabled={submitting || saving}
                title="Save progress (Ctrl+S)"
              >
                <Save className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Save</span>
              </Button>
            )}
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={requestSubmit}
              disabled={submitting}
              title={preview ? "Save these answers as the answer key" : "Submit test"}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : preview ? (
                <Save className="size-4" aria-hidden />
              ) : null}
              {preview ? "Save answer key" : "Submit"}
            </Button>
          </div>
        </div>

        <QuestionStrip
          steps={steps}
          labels={questions.map((q, i) => labels.get(q.id) ?? String(i + 1))}
          currentIdx={currentIdx}
          disabled={submitting}
          onGo={(i) => void goTo(i)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs tabular-nums">
          Question {currentIdx + 1} of {questions.length}
          <span aria-hidden> · </span>
          {totalAnswered} of {totalAnswerable} answered
        </p>
        <Button
          type="button"
          variant={isFlagged ? "outline" : "ghost"}
          size="sm"
          aria-pressed={isFlagged}
          onClick={toggleFlag}
          disabled={submitting}
          title="Flag this question to come back to it (Alt+F)"
          className={cn(isFlagged && "border-warning/60 text-foreground")}
        >
          <Flag className={cn("size-4", isFlagged && "fill-warning text-warning")} aria-hidden />
          {isFlagged ? "Flagged" : "Flag for review"}
        </Button>
      </div>

      {/* No height cap - let the question consume as much vertical space
          as it needs. Scrolling happens at the page level. */}
      <QuestionView
        question={current}
        path={currentLabel}
        labels={labels}
        answers={answers}
        onAnswer={updateAnswer}
        disabled={submitting || expired}
        testId={testId}
        // Each attempt gets its own choice order. Preview has no attempt,
        // so it uses a fixed seed and the tutor still sees shuffled choices.
        shuffleSeed={submissionId ?? `preview:${testId}`}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void goTo(currentIdx - 1)}
          disabled={submitting || currentIdx === 0}
        >
          <ArrowLeft className="size-4" aria-hidden /> Previous
        </Button>

        {!last ? (
          <Button type="button" onClick={() => void goTo(currentIdx + 1)} disabled={submitting}>
            Next <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="brand" onClick={requestSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {preview ? "Save answer key" : "Submit test"}
          </Button>
        )}
      </div>

      <div className="text-muted-foreground space-y-1 text-xs">
        {preview ? (
          <p>Leave a question blank to mark it by hand.</p>
        ) : saveError ? (
          <p className="text-destructive">
            Your last save failed ({saveError}). Press Save to try again
            before leaving this page.
          </p>
        ) : (
          <p>Your answers save as you go.</p>
        )}
        <p className="hidden sm:block">
          <Kbd>Alt</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd> previous and next question,{" "}
          <Kbd>Alt</Kbd> <Kbd>F</Kbd> flag
          {preview ? null : (
            <>
              , <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> save
            </>
          )}
          .
        </p>
      </div>

      {!preview && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit this test?</AlertDialogTitle>
              <AlertDialogDescription>
                {unanswered.length > 0
                  ? `You've answered ${totalAnswered} of ${totalAnswerable} questions. `
                  : "You've answered every question. "}
                {"Once submitted you can't change your answers."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {unanswered.length > 0 || flaggedSteps.length > 0 || saveError ? (
              <div className="space-y-3 text-sm">
                {saveError ? (
                  <p className="text-destructive flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Your last save failed. Submitting sends your answers again.
                  </p>
                ) : null}
                {unanswered.length > 0 ? (
                  <JumpList
                    title="Not answered"
                    items={unanswered.slice(0, SUMMARY_LIMIT).map((u) => ({ key: u.id, label: u.label, go: () => { setConfirmOpen(false); void goTo(u.stepIndex, u.id); } }))}
                    more={Math.max(0, unanswered.length - SUMMARY_LIMIT)}
                  />
                ) : null}
                {flaggedSteps.length > 0 ? (
                  <JumpList
                    title="Flagged"
                    items={flaggedSteps.map((s) => ({ key: s.id, label: s.label, go: () => { setConfirmOpen(false); void goTo(s.i); } }))}
                    more={0}
                  />
                ) : null}
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep working</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  void onSubmit(false);
                }}
              >
                Submit test
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Question strip                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * A button per step. Answered is solid, partly answered half filled, not
 * answered an outline; a failed save adds a red border and an icon, a flag
 * a corner mark. The current step has a ring and is kept in view.
 */
function QuestionStrip({
  steps,
  labels,
  currentIdx,
  disabled,
  onGo,
}: {
  steps: StepSummary[];
  labels: string[];
  currentIdx: number;
  disabled: boolean;
  onGo: (i: number) => void;
}) {
  const currentRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentIdx]);

  return (
    <nav aria-label="Questions" className="-mx-1 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
      <ol className="flex w-max gap-1.5 px-1 py-1">
        {steps.map((s, i) => {
          const active = i === currentIdx;
          return (
            <li key={i}>
              <button
                ref={active ? currentRef : undefined}
                type="button"
                onClick={() => onGo(i)}
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                aria-label={stepName(labels[i] ?? String(i + 1), s)}
                className={cn(
                  "relative inline-flex h-8 min-w-9 items-center justify-center gap-0.5 overflow-hidden rounded-md border px-2 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  s.state === "done"
                    ? "border-brand-terracotta bg-brand-terracotta text-brand-terracotta-foreground"
                    : s.state === "partial"
                      ? "border-brand-terracotta/60 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  s.unsaved && "border-destructive",
                  active && "ring-foreground ring-2 ring-offset-2 ring-offset-background",
                )}
              >
                {s.state === "partial" ? (
                  <span aria-hidden className="bg-brand-terracotta/25 absolute inset-x-0 bottom-0 h-1/2" />
                ) : null}
                {s.unsaved ? <AlertTriangle aria-hidden className="text-destructive relative size-3" /> : null}
                <span className="relative">{labels[i]}</span>
                {s.flagged ? (
                  <span
                    aria-hidden
                    className="border-t-warning absolute top-0 right-0 size-0 border-t-[9px] border-l-[9px] border-l-transparent"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The submit summary's lists of question labels that jump to the question. */
function JumpList({
  title,
  items,
  more,
}: {
  title: string;
  items: Array<{ key: string; label: string; go: () => void }>;
  more: number;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onClick={it.go}
              aria-label={`Go to question ${it.label}`}
              className="border-border hover:bg-muted h-7 min-w-9 rounded-md border px-2 text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {it.label}
            </button>
          </li>
        ))}
        {more > 0 ? <li className="text-muted-foreground self-center text-xs">and {more} more</li> : null}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Countdown                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Owns the 1s tick so only this badge re-renders each second. The badge
 * renders nothing until mounted: the server would stamp one value into the
 * HTML and hydration would compute another, which React reports as a
 * mismatch. The live region is always there, so screen readers hear the
 * 5-minute and 1-minute warnings (not every second).
 */
function Countdown({
  deadline,
  onExpire,
  alwaysShow,
  cutShort,
}: {
  deadline: number;
  onExpire: () => void;
  /** Timed tests always show the clock; untimed ones only near the due date. */
  alwaysShow: boolean;
  /** The due date ends this attempt before its time limit would. */
  cutShort: boolean;
}) {
  const [now, setNow] = React.useState<number | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const prevRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining =
    now == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  React.useEffect(() => {
    if (remaining == null) return;
    if (remaining === 0) onExpire();
    const msg = timerWarning(prevRef.current, remaining);
    if (msg) setAnnounce(msg);
    prevRef.current = remaining;
  }, [remaining, onExpire]);

  const visible = remaining != null && (alwaysShow || remaining <= SHOW_DUE_CLOCK_WITHIN_S);
  const low = remaining != null && remaining <= 60 && remaining > 0;
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
      {visible ? (
        <Badge
          variant={low ? "destructive" : "soft"}
          className="font-mono tabular-nums"
          title={
            cutShort || !alwaysShow
              ? "The test closes at its due time, so this is less than the full time limit."
              : "Time left"
          }
        >
          <span className="sr-only">Time left </span>
          {formatTime(remaining)}
          {(cutShort || !alwaysShow) && (
            <span className="ml-1 font-sans font-normal opacity-75">until due</span>
          )}
        </Badge>
      ) : null}
    </>
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
  labels,
  answers,
  onAnswer,
  disabled,
  testId,
  shuffleSeed,
}: {
  question: RunnerQuestion;
  /** Display path (e.g. "1", "1.a") used as a small caption above the input. */
  path: string;
  /** id → label from the test's numbering scheme. */
  labels: Map<string, string>;
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, next: unknown) => void;
  disabled?: boolean;
  testId: string;
  /** Per-attempt seed for choice order (see lib/shuffle.ts). */
  shuffleSeed: string;
}) {
  const isContext = (question.type as string) === "NONE";
  const hasChildren = question.subQuestions.length > 0;

  return (
    <Card
      id={questionAnchor(question.id)}
      // scroll-mt clears the runner's sticky header and question strip.
      className={cn(
        "scroll-mt-32 space-y-5 p-4 sm:p-6",
        question.parentId && "border-brand-terracotta/30",
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
            : `Question ${path} - ${question.points} ${question.points === 1 ? "point" : "points"}`}
        </p>
        <LessonMarkdown content={question.question} />
      </div>

      {!isContext && (
        <QuestionRenderer
          shuffleSeed={shuffleSeed}
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
            const childPath = labels.get(child.id) ?? nextPath(path, i, depthOf(path));
            return (
              <QuestionView
                key={child.id}
                question={child}
                path={childPath}
                labels={labels}
                answers={answers}
                onAnswer={onAnswer}
                disabled={disabled}
                testId={testId}
                shuffleSeed={shuffleSeed}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** DOM id of a question card, for jumping to a part from the side panel. */
function questionAnchor(questionId: string): string {
  return `question-${questionId}`;
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
