"use client";

/**
 * The grading page's shared state (#150, "Grade a submission"): the frame's
 * primary header shows the live score, and its secondary header the rubric
 * and the AI suggestions, while the marks themselves live in GradingForm.
 * GradingForm publishes what the headers need here; the headers only read
 * it and call back.
 */

import * as React from "react";
import { BookOpen, ChevronLeft, ChevronRight, Keyboard, Sparkles } from "lucide-react";
import Link from "next/link";

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
import { Kbd } from "@/components/ui/kbd";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RibbonButton, RibbonToolbar } from "@/components/shell/ribbon";
import { useReadOnly } from "@/components/shell/workspace-access";
import type { Rubric } from "@/features/ai-marking/rules";
import { cn } from "@/lib/utils";

import { MARK_SHORTCUTS } from "../lib/marking-flow";
import { CONFIDENCE, flagLabel, isSafeToBulkAccept, riskRank, type AiSuggestion } from "../lib/ai-marking-ui";

export type GradingBridge = {
  score: number;
  outOf: number;
  /** Suggestions ready and not yet decided, with their question labels. */
  toReview: Array<{ suggestion: AiSuggestion; label: string }>;
  working: number;
  acceptMany: (ids: string[]) => void;
};

const Ctx = React.createContext<{ bridge: GradingBridge | null; setBridge: (b: GradingBridge | null) => void } | null>(null);

export function GradingSessionProvider({ children }: { children: React.ReactNode }) {
  const [bridge, setBridge] = React.useState<GradingBridge | null>(null);
  const value = React.useMemo(() => ({ bridge, setBridge }), [bridge]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** GradingForm calls this each render with its current state. */
export function usePublishGrading(b: GradingBridge) {
  const ctx = React.useContext(Ctx);
  const setBridge = ctx?.setBridge;
  const key = `${b.score}|${b.outOf}|${b.working}|${b.toReview.map((t) => t.suggestion.id).join(",")}`;
  const latest = React.useRef(b);
  latest.current = b;
  React.useEffect(() => {
    if (!setBridge) return;
    setBridge({ ...latest.current, acceptMany: (ids) => latest.current.acceptMany(ids) });
  }, [setBridge, key]);
  React.useEffect(() => () => setBridge?.(null), [setBridge]);
}

function useBridge() {
  return React.useContext(Ctx)?.bridge ?? null;
}

/** The score in the primary header: the sum of the marks so far. */
export function LiveScore({ initial }: { initial: { score: number; outOf: number } | null }) {
  const b = useBridge();
  const score = b?.score ?? initial?.score ?? 0;
  const outOf = b?.outOf ?? initial?.outOf ?? 0;
  const pct = outOf > 0 ? Math.round((score / outOf) * 100) : null;
  return (
    <span className="text-foreground text-sm font-medium whitespace-nowrap tabular-nums" aria-label={`Mark ${score} out of ${outOf}`}>
      {score}
      <span className="text-muted-foreground"> / {outOf}</span>
      {pct != null ? <span className="text-muted-foreground hidden text-xs sm:inline"> ({pct}%)</span> : null}
    </span>
  );
}

const linkCls =
  "text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4";

/** The secondary header: Previous and Next, then the rubric and the AI suggestions. */
export function GradingRibbon({
  prevHref,
  nextHref,
  position,
  rubrics,
  aiEnabled,
  progress,
}: {
  prevHref: string | null;
  nextHref: string | null;
  /** "3 of 12". */
  position: string | null;
  rubrics: Array<{ id: string; label: string; points: number; rubric: Rubric | null }>;
  aiEnabled: boolean;
  /** How much of the test is marked. */
  progress?: { marked: number; total: number };
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <nav aria-label="Submissions" className="flex shrink-0 items-center gap-1">
        {prevHref ? (
          <Link href={prevHref} className={linkCls} aria-label="Previous submission">
            <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
          </Link>
        ) : (
          <span className={cn(linkCls, "opacity-40")} aria-disabled="true">
            <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
          </span>
        )}
        {position ? <span className="text-muted-foreground px-1 text-xs whitespace-nowrap tabular-nums">{position}</span> : null}
        {nextHref ? (
          <Link href={nextHref} className={linkCls} aria-label="Next submission">
            <span className="hidden sm:inline">Next</span> <ChevronRight />
          </Link>
        ) : (
          <span className={cn(linkCls, "opacity-40")} aria-disabled="true">
            <span className="hidden sm:inline">Next</span> <ChevronRight />
          </span>
        )}
      </nav>
      {progress && progress.total > 0 ? (
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <ProgressBar
            label="Scripts marked"
            value={progress.marked}
            max={progress.total}
            valueText={`${progress.marked} of ${progress.total} marked`}
            tone={progress.marked === progress.total ? "success" : "primary"}
            className="w-28"
          />
          <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
            {progress.marked} of {progress.total} marked
          </span>
        </div>
      ) : null}
      <RibbonToolbar label="Marking tools">
        <ShortcutsButton />
        <RubricButton rubrics={rubrics} />
        {aiEnabled ? <AiSuggestionsButton /> : null}
      </RibbonToolbar>
    </div>
  );
}

/** What the keys do while marking (lib/marking-flow.ts). */
function ShortcutsButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <RibbonButton onClick={() => setOpen(true)} aria-label="Keyboard shortcuts">
        <Keyboard /> <span className="hidden sm:inline">Keys</span>
      </RibbonButton>
      <span id="marking-keys" className="sr-only">
        Enter for the next question, F for full marks, C to comment.
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark with the keyboard</DialogTitle>
            <DialogDescription>Start in a mark box. Ctrl and Enter (⌘ and Enter on a Mac) work anywhere on the page.</DialogDescription>
          </DialogHeader>
          <dl className="divide-border divide-y text-sm">
            {MARK_SHORTCUTS.map((s) => (
              <div key={s.does} className="flex items-center justify-between gap-4 py-2">
                <dt className="flex gap-1">{s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dt>
                <dd className="text-muted-foreground">{s.does}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RubricButton({ rubrics }: { rubrics: Array<{ id: string; label: string; points: number; rubric: Rubric | null }> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <RibbonButton onClick={() => setOpen(true)}>
        <BookOpen /> Rubric
      </RibbonButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rubric</DialogTitle>
            <DialogDescription>What each written question is marked on. The AI marks against the same criteria.</DialogDescription>
          </DialogHeader>
          {rubrics.length === 0 ? (
            <p className="text-muted-foreground text-sm">This test has no short-answer or essay questions.</p>
          ) : (
            <ul className="space-y-4">
              {rubrics.map((r) => (
                <li key={r.id} className="space-y-1">
                  <p className="text-foreground text-sm font-medium">
                    Question {r.label} <span className="text-muted-foreground font-normal">· {r.points} {r.points === 1 ? "point" : "points"}</span>
                  </p>
                  {r.rubric && r.rubric.criteria.length > 1 ? (
                    <ul className="text-muted-foreground space-y-0.5 pl-4 text-sm">
                      {r.rubric.criteria.map((c) => (
                        <li key={c.id} className="flex justify-between gap-3">
                          <span>{c.label}</span>
                          <span className="tabular-nums">{c.max}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground pl-4 text-sm">One criterion: the whole answer, against the memo.</p>
                  )}
                  {r.rubric?.notes ? <p className="text-muted-foreground pl-4 text-xs">{r.rubric.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AiSuggestionsButton() {
  const b = useBridge();
  const readOnly = useReadOnly();
  const [open, setOpen] = React.useState(false);
  const [risky, setRisky] = React.useState(false);
  const items = React.useMemo(
    () => [...(b?.toReview ?? [])].sort((x, y) => riskRank(x.suggestion) - riskRank(y.suggestion)),
    [b?.toReview],
  );
  const safe = items.filter((i) => isSafeToBulkAccept(i.suggestion));
  const take = risky ? items : safe;
  const n = items.length;

  function jump(questionId: string) {
    setOpen(false);
    window.setTimeout(() => document.getElementById(`q-${questionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <>
      <RibbonButton onClick={() => setOpen(true)} aria-label={`AI suggestions: ${n} to review`}>
        <Sparkles />
        <span className="hidden sm:inline">AI suggestions</span>
        <span
          className={cn(
            "rounded-full px-1.5 text-xs tabular-nums",
            n > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {b?.working ? "…" : n}
        </span>
      </RibbonButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI suggestions</DialogTitle>
            <DialogDescription>
              {n === 0
                ? b?.working
                  ? "The AI is still marking. Suggestions appear on each question as they arrive."
                  : "Nothing waiting: every suggestion on this submission has been accepted, edited or rejected."
                : `${n} ${n === 1 ? "suggestion is" : "suggestions are"} waiting for you, riskiest first. None counts until you accept it and save the mark.`}
            </DialogDescription>
          </DialogHeader>
          {n > 0 ? (
            <ul className="divide-border divide-y text-sm">
              {items.map(({ suggestion: s, label }) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => jump(s.questionId)}
                    className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2 text-left"
                  >
                    <span className="font-medium tabular-nums">Question {label}</span>
                    <span className="tabular-nums">
                      {s.totalAwarded} / {s.outOf}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {s.confidence ? CONFIDENCE[s.confidence].label : ""}
                      {s.flags.length ? ` · ${s.flags.map((f) => flagLabel(f).label).join(", ")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {n > 0 ? (
            <DialogFooter className="flex-col items-stretch gap-3 sm:flex-col">
              {safe.length < n ? (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={risky} onCheckedChange={(c) => setRisky(c === true)} className="mt-0.5" />
                  <span>Include flagged and low-confidence suggestions ({n - safe.length})</span>
                </label>
              ) : null}
              <Button
                type="button"
                variant="brand"
                disabled={readOnly || take.length === 0}
                onClick={() => {
                  b?.acceptMany(take.map((t) => t.suggestion.id));
                  setOpen(false);
                }}
              >
                {take.length === 1 ? "Accept 1 suggestion" : take.length === n ? "Accept all suggestions" : `Accept ${take.length} suggestions`}
              </Button>
              <p className="text-muted-foreground text-xs">Accepted marks fill in the scores. Save the mark to confirm them.</p>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
