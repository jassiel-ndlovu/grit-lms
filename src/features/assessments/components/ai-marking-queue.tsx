"use client";

/**
 * "Mark with AI" on a test's submissions page (#150). Calls
 * `requestAiMarking` for every written question or the chosen ones, says
 * what was queued and skipped, and shows the class's progress. While
 * anything is queued or running it refreshes the page every few seconds
 * (the counts come from the server), so the progress moves on its own.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WriteGuard } from "@/components/shell/workspace-access";
import { requestAiMarking } from "@/features/ai-marking/actions";

import { progressLabel, queuedLabel, type AiProgress } from "../lib/ai-marking-ui";
import { ProgressBar } from "@/components/ui/progress-bar";

type RequestAiMarking = (input: { testId: string; questionIds?: string[] }) => Promise<{ data?: { queued: number; skipped: number }; serverError?: string } | undefined>;

export type QueueQuestion = { id: string; label: string; preview: string };

const POLL_MS = 5000;

export function AiMarkingQueue({
  testId,
  questions,
  progress,
  action = requestAiMarking as unknown as RequestAiMarking,
}: {
  testId: string;
  /** The test's short-answer and essay questions. */
  questions: QueueQuestion[];
  /** Counts over the whole test, from the server. */
  progress: AiProgress;
  /** For the preview pages only; the real action by default. */
  action?: RequestAiMarking;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set(questions.map((q) => q.id)));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ queued: number; skipped: number } | null>(null);

  const working = progress.queued + progress.running > 0;
  React.useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [working, router]);

  const all = chosen.size === questions.length;

  async function run() {
    setPending(true);
    setError(null);
    try {
      const r = await action({ testId, questionIds: all ? undefined : [...chosen] });
      if (r?.serverError) throw new Error(r.serverError);
      if (!r?.data) throw new Error("No answer from the server. Try again.");
      setResult(r.data);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't start AI marking. Try again.");
    } finally {
      setPending(false);
    }
  }

  const done = progress.done + progress.failed + progress.skipped;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;

  return (
    <section aria-label="AI-suggested marks" className="border-border space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
            <Sparkles aria-hidden className="size-4" /> AI-suggested marks
          </p>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {progressLabel(progress)}
            {working ? " · updating" : ""}
          </p>
        </div>
        <WriteGuard label="Mark with AI">
          <Button type="button" size="sm" variant="outline" onClick={() => (setResult(null), setError(null), setOpen(true))} disabled={questions.length === 0}>
            <Sparkles className="size-4" /> Mark with AI
          </Button>
        </WriteGuard>
      </div>

      {progress.total > 0 ? (
        <ProgressBar label="AI marking progress" value={pct} />
      ) : null}

      {result ? (
        <p role="status" className="text-foreground text-sm">
          {queuedLabel(result)}
        </p>
      ) : null}
      {error && !open ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {questions.length === 0 ? (
        <p className="text-muted-foreground text-xs">This test has no short-answer or essay questions to mark.</p>
      ) : null}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark with AI</DialogTitle>
            <DialogDescription>
              The AI suggests a mark for each handed-in answer. You review every one on the student&apos;s page before
              it counts. Answers already marked are not sent again.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="text-foreground mb-1 text-sm font-medium">Questions</legend>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={all}
                onCheckedChange={(c) => setChosen(c === true ? new Set(questions.map((q) => q.id)) : new Set())}
              />
              All written questions ({questions.length})
            </label>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pl-6">
              {questions.map((q) => (
                <li key={q.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={chosen.has(q.id)}
                      onCheckedChange={(c) =>
                        setChosen((prev) => {
                          const next = new Set(prev);
                          if (c === true) next.add(q.id);
                          else next.delete(q.id);
                          return next;
                        })
                      }
                    />
                    <span className="flex min-w-0 gap-1.5">
                      <span className="shrink-0 font-medium tabular-nums">{q.label}</span>
                      <span className="text-muted-foreground truncate">{q.preview}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="brand" onClick={run} disabled={pending || chosen.size === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Mark {all ? "all" : chosen.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
