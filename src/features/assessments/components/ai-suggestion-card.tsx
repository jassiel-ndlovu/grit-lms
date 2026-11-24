"use client";

/**
 * One AI suggestion under a short-answer or essay question (#150): the
 * suggested mark, its reasoning per criterion with the quoted evidence,
 * the confidence, any flags and whether the larger model re-marked it.
 * The tutor accepts, edits or rejects it; nothing is filled in before that.
 */

import * as React from "react";
import { AlertTriangle, Check, Loader2, Pencil, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/shell/status-chip";
import { cn } from "@/lib/utils";

import {
  CONFIDENCE,
  PROVENANCE,
  criteriaOf,
  flagLabel,
  isPending,
  type AiSuggestion,
  type Provenance,
} from "../lib/ai-marking-ui";

export function AiSuggestionCard({
  suggestion: s,
  provenance,
  canUndo,
  disabled,
  onAccept,
  onEdit,
  onReject,
  onUndo,
}: {
  suggestion: AiSuggestion;
  provenance: Provenance;
  /** The decision was made on this page and isn't saved yet. */
  canUndo: boolean;
  /** Read-only workspace. */
  disabled: boolean;
  onAccept: (s: AiSuggestion) => void;
  onEdit: (s: AiSuggestion) => void;
  onReject: (s: AiSuggestion) => void;
  onUndo: (s: AiSuggestion) => void;
}) {
  if (isPending(s)) {
    return (
      <div className="border-border text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-3 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" /> The AI is marking this answer…
      </div>
    );
  }
  if (s.status === "FAILED" || s.status === "SKIPPED" || s.totalAwarded == null) {
    return (
      <div className="border-border text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3 text-sm">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          No AI suggestion for this answer{s.error ? `: ${s.error}` : ""}. Mark it yourself.
        </span>
      </div>
    );
  }

  const criteria = criteriaOf(s.criteria);
  const decided = provenance !== "suggested";
  const chip = PROVENANCE[provenance];

  return (
    <div
      data-provenance={provenance}
      className={cn(
        "space-y-3 rounded-md border p-3",
        provenance === "suggested" ? "border-primary/40 bg-primary/5 border-dashed" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium">
          <Sparkles aria-hidden className="size-4" /> AI suggests{" "}
          <span className="tabular-nums">
            {s.totalAwarded} / {s.outOf}
          </span>
        </span>
        {s.confidence ? <StatusChip tone={CONFIDENCE[s.confidence].tone}>{CONFIDENCE[s.confidence].label}</StatusChip> : null}
        {s.escalated ? <StatusChip tone="info">Marked again by a stronger AI</StatusChip> : null}
        {s.flags.map((f) => (
          <StatusChip key={f} tone="warning" title={flagLabel(f).hint}>
            {flagLabel(f).label}
          </StatusChip>
        ))}
      </div>

      {criteria.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {criteria.map((c) => (
            <li key={c.id} className="space-y-1">
              <p className="flex justify-between gap-3">
                <span className="text-foreground font-medium">{c.label}</span>
                <span className="tabular-nums">
                  {c.awarded} / {c.max}
                </span>
              </p>
              {c.justification ? <p className="text-muted-foreground">{c.justification}</p> : null}
              {c.evidence.length > 0 ? (
                <ul className="space-y-0.5">
                  {c.evidence.map((e, i) => (
                    <li key={i} className="border-warning/60 text-foreground border-l-2 pl-2 text-xs italic">
                      “{e}”
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {s.feedbackToStudent ? (
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">Draft feedback for the student</p>
          <p className="text-foreground">{s.feedbackToStudent}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {decided ? (
          <>
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
            {canUndo ? (
              <>
                <span className="text-muted-foreground text-xs">The student sees this when you save the mark.</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onUndo(s)} disabled={disabled}>
                  Undo
                </Button>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => onAccept(s)} disabled={disabled}>
              <Check className="size-3.5" /> Accept {s.totalAwarded}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onEdit(s)} disabled={disabled}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onReject(s)} disabled={disabled}>
              <X className="size-3.5" /> Reject
            </Button>
            <span className="text-muted-foreground text-xs">Not counted until you accept it.</span>
          </>
        )}
      </div>
    </div>
  );
}

/** The student's answer with the AI's evidence quotes marked. */
export function HighlightedAnswer({ runs }: { runs: Array<{ text: string; mark: boolean }> }) {
  return (
    <p className="text-foreground text-sm whitespace-pre-wrap">
      {runs.map((r, i) =>
        r.mark ? (
          <mark key={i} className="bg-warning/25 text-foreground rounded-sm px-0.5">
            {r.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{r.text}</React.Fragment>
        ),
      )}
    </p>
  );
}
