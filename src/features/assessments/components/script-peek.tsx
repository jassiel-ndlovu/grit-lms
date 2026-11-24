"use client";

/** The peek panel on a test's Submissions page: one script at a glance. */

import * as React from "react";
import { Circle, CircleCheck } from "lucide-react";

import { useDateContext } from "@/components/preferences-provider";
import { StatusChip } from "@/components/shell/status-chip";
import { PeekProvider, type PeekItem } from "@/components/ui/peek-panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { formatDate } from "@/lib/datetime";

import { peekScript, type ScriptPeek } from "../peek-actions";

async function load(id: string): Promise<ScriptPeek | null> {
  const r = await peekScript({ submissionId: id });
  return r?.data ?? null;
}

const CHIP = {
  GRADED: { tone: "success", label: "Graded" },
  SUBMITTED: { tone: "info", label: "To mark" },
  IN_PROGRESS: { tone: "neutral", label: "In progress" },
} as const;

export function ScriptPeeks({ items, children, load: loadWith = load }: {
  items: PeekItem[];
  children: React.ReactNode;
  /** For samples. */
  load?: (id: string) => Promise<ScriptPeek | null>;
}) {
  return (
    <PeekProvider items={items} load={loadWith} render={(d) => <ScriptPeekBody d={d} />}>
      {children}
    </PeekProvider>
  );
}

export function ScriptPeekBody({ d }: { d: ScriptPeek }) {
  const ctx = useDateContext();
  const when = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const answered = d.questions.filter((q) => q.answered).length;
  const chip = CHIP[d.status];
  return (
    <>
      <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      <PropertyList>
        <PropertyRow label="Email">{d.email}</PropertyRow>
        <PropertyRow label={d.submittedAt ? "Submitted" : "Started"}>{when(d.submittedAt ?? d.startedAt)}</PropertyRow>
        {d.grade ? (
          <PropertyRow label="Grade">
            <span className="tabular-nums">
              {d.grade.score} / {d.grade.outOf}
            </span>
          </PropertyRow>
        ) : null}
        {d.files ? <PropertyRow label="Files">{d.files}</PropertyRow> : null}
      </PropertyList>
      {d.grade?.comments ? <p className="text-foreground text-sm whitespace-pre-line">{d.grade.comments}</p> : null}
      <section aria-labelledby="peek-questions" className="space-y-3">
        <div className="space-y-1.5">
          <h3 id="peek-questions" className="text-foreground text-sm font-semibold">
            {answered} of {d.questions.length} answered
          </h3>
          <ProgressBar label="Questions answered" value={answered} max={d.questions.length} valueText={`${answered} of ${d.questions.length}`} />
        </div>
        <ul className="divide-border divide-y text-sm">
          {d.questions.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-2">
              {q.answered ? (
                <CircleCheck aria-label="Answered" className="text-success size-4 shrink-0" />
              ) : (
                <Circle aria-label="Not answered" className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="shrink-0 font-medium tabular-nums">{q.label}</span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate">{q.preview}</span>
              <span className="text-foreground shrink-0 tabular-nums">
                {q.score ?? "-"}
                <span className="text-muted-foreground"> / {q.points}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
