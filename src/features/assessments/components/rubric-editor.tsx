"use client";

/**
 * RubricEditor (#216, phase 1): split a written question's marks into
 * named criteria, in the test designer. Off by default: "Add a rubric"
 * starts one criterion holding the question's points. While a rubric is
 * on, the question is worth the criteria's total (the editor's Points box
 * shows it read-only). Shape and rules: lib/rubric.ts.
 */

import * as React from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { MAX_CRITERIA, MAX_CRITERION_MARKS, newCriterion, rubricTotal, starterRubric, type Rubric } from "../lib/rubric";

export function RubricEditor({
  value,
  points,
  onChange,
  idPrefix,
}: {
  value: Rubric | null;
  /** The question's points, used to start a rubric. */
  points: number;
  onChange: (next: Rubric | null) => void;
  /** Keeps ids unique when several questions are open. */
  idPrefix: string;
}) {
  if (!value) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(starterRubric(points))}>
          <ListChecks /> Add a rubric
        </Button>
        <span className="text-muted-foreground text-xs">Split the marks into criteria, for you and for AI marking.</span>
      </div>
    );
  }

  const set = (patch: Partial<Rubric>) => onChange({ ...value, ...patch });
  const setCriterion = (i: number, patch: Partial<Rubric["criteria"][number]>) =>
    set({ criteria: value.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <fieldset className="border-border space-y-3 rounded-md border p-3">
      <legend className="text-foreground px-1 text-xs font-medium">Rubric</legend>
      <ol className="space-y-2">
        {value.criteria.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            <span aria-hidden className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">
              {i + 1}
            </span>
            <label htmlFor={`${idPrefix}-crit-${c.id}`} className="sr-only">
              Criterion {i + 1}
            </label>
            <Input
              id={`${idPrefix}-crit-${c.id}`}
              value={c.label}
              maxLength={200}
              placeholder="e.g. Uses evidence from the text"
              onChange={(e) => setCriterion(i, { label: e.target.value })}
              className="h-9 min-w-0 flex-1"
            />
            <label htmlFor={`${idPrefix}-max-${c.id}`} className="sr-only">
              Marks for criterion {i + 1}
            </label>
            <Input
              id={`${idPrefix}-max-${c.id}`}
              type="number"
              min={1}
              max={MAX_CRITERION_MARKS}
              value={c.max}
              onChange={(e) => setCriterion(i, { max: Math.max(1, Math.min(MAX_CRITERION_MARKS, Math.round(Number(e.target.value) || 1))) })}
              className="h-9 w-20 shrink-0 tabular-nums"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove criterion ${i + 1}`}
              disabled={value.criteria.length === 1}
              onClick={() => set({ criteria: value.criteria.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={value.criteria.length >= MAX_CRITERIA}
          onClick={() => set({ criteria: [...value.criteria, newCriterion()] })}
        >
          <Plus /> Add a criterion
        </Button>
        <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
          Worth {rubricTotal(value)} {rubricTotal(value) === 1 ? "mark" : "marks"} in all
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={value.halfMarks === true} onCheckedChange={(v) => set({ halfMarks: v === true })} />
        Allow half marks
      </label>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-notes`} className="text-foreground text-xs font-medium">
          Notes for markers <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={2}
          maxLength={2000}
          value={value.notes ?? ""}
          placeholder="What earns full marks on each criterion"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange(null)}>
        Remove the rubric
      </Button>
    </fieldset>
  );
}
