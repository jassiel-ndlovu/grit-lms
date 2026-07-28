"use client";

/**
 * TestQuestionEditor — recursive editor for a single TestQuestion.
 *
 * Rendered inside a <TestForm> question tree. Owns nothing directly:
 * the parent holds the full tree in state and passes down `(value,
 * onChange, onRemove)` so re-arrangement stays with the outer form.
 *
 * Type-specific fields:
 *   - MULTIPLE_CHOICE / MULTI_SELECT: options editor + correct choice(s)
 *   - TRUE_FALSE:                     radio for true / false
 *   - SHORT_ANSWER / NUMERIC / CODE:  free-text correct answer
 *   - ESSAY / FILE_UPLOAD:            no key answer (subjective / upload)
 *   - MATCHING:                       list of {left, right} pairs
 *   - REORDER:                        list of items in intended order
 *   - FILL_IN_THE_BLANK:              blankCount + array of correct answers
 *   - NONE:                           no fields — context block only
 *
 * Sub-questions render recursively at any depth. NONE-typed parents are
 * marked with a "Context" pill in the header so tutors can spot them.
 */

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ─── Shape ────────────────────────────────────────────────────────────── */

export type EditorQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "ESSAY"
  | "FILE_UPLOAD"
  | "MULTI_SELECT"
  | "CODE"
  | "MATCHING"
  | "REORDER"
  | "FILL_IN_THE_BLANK"
  | "NUMERIC"
  | "NONE";

export interface EditorQuestion {
  /** Client-side stable key; used by React and stripped before submit. */
  clientId: string;
  question: string;
  type: EditorQuestionType;
  points: number;
  options: string[];
  answer: unknown;
  language: string | null;
  matchPairs: Array<{ left: string; right: string }>;
  reorderItems: string[];
  blankCount: number | null;
  subQuestions: EditorQuestion[];
}

const TYPE_LABELS: Record<EditorQuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / false",
  SHORT_ANSWER: "Short answer",
  ESSAY: "Essay",
  FILE_UPLOAD: "File upload",
  MULTI_SELECT: "Multi-select",
  CODE: "Code",
  MATCHING: "Matching",
  REORDER: "Reorder",
  FILL_IN_THE_BLANK: "Fill in the blank",
  NUMERIC: "Numeric",
  NONE: "Context (no answer)",
};

/** Fresh blank question — kept here so the outer form and this component
 *  share the default shape. */
export function blankQuestion(): EditorQuestion {
  return {
    clientId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question: "",
    type: "SHORT_ANSWER",
    points: 1,
    options: [],
    answer: null,
    language: null,
    matchPairs: [],
    reorderItems: [],
    blankCount: null,
    subQuestions: [],
  };
}

/* ─── Component ────────────────────────────────────────────────────────── */

export interface TestQuestionEditorProps {
  question: EditorQuestion;
  onChange: (next: EditorQuestion) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Dotted label such as "1" or "1.a" — computed by the parent. */
  label: string;
  depth: number;
}

export function TestQuestionEditor({
  question,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  label,
  depth,
}: TestQuestionEditorProps) {
  const isContext = question.type === "NONE";

  function patch<K extends keyof EditorQuestion>(
    key: K,
    value: EditorQuestion[K],
  ) {
    onChange({ ...question, [key]: value });
  }

  function updateType(nextType: EditorQuestionType) {
    // Reset type-specific fields to sensible defaults on type change so
    // stale MC options don't accidentally travel with a NUMERIC question.
    onChange({
      ...question,
      type: nextType,
      options:
        nextType === "MULTIPLE_CHOICE" || nextType === "MULTI_SELECT"
          ? question.options.length > 0
            ? question.options
            : ["", ""]
          : [],
      answer: null,
      matchPairs:
        nextType === "MATCHING"
          ? question.matchPairs.length > 0
            ? question.matchPairs
            : [{ left: "", right: "" }]
          : [],
      reorderItems:
        nextType === "REORDER"
          ? question.reorderItems.length > 0
            ? question.reorderItems
            : ["", ""]
          : [],
      blankCount: nextType === "FILL_IN_THE_BLANK" ? question.blankCount ?? 1 : null,
      language: nextType === "CODE" ? question.language ?? "" : null,
      points: nextType === "NONE" ? 0 : question.points || 1,
    });
  }

  /* ─── Sub-question mutators ─── */

  function addSubQuestion() {
    onChange({
      ...question,
      subQuestions: [...question.subQuestions, blankQuestion()],
    });
  }
  function updateSub(idx: number, next: EditorQuestion) {
    const copy = question.subQuestions.slice();
    copy[idx] = next;
    onChange({ ...question, subQuestions: copy });
  }
  function removeSub(idx: number) {
    onChange({
      ...question,
      subQuestions: question.subQuestions.filter((_, i) => i !== idx),
    });
  }
  function moveSub(idx: number, dir: -1 | 1) {
    const copy = question.subQuestions.slice();
    const j = idx + dir;
    if (j < 0 || j >= copy.length) return;
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange({ ...question, subQuestions: copy });
  }

  const SUB_LETTERS = "abcdefghijklmnopqrstuvwxyz";

  return (
    <Card
      className={cn(
        "space-y-4 p-5",
        isContext && "border-muted-foreground/30 bg-muted/20",
        depth > 0 && "border-brand-terracotta/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "text-xs font-medium tabular-nums",
              isContext ? "text-muted-foreground" : "text-brand-terracotta",
            )}
          >
            {isContext ? `Context ${label}` : `Question ${label}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onMoveUp}
              aria-label="Move up"
            >
              <ChevronUp className="size-3.5" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onMoveDown}
              aria-label="Move down"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-7"
            onClick={onRemove}
            aria-label="Remove question"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Type
          </label>
          <Select value={question.type} onValueChange={(v) => updateType(v as EditorQuestionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as EditorQuestionType[])
                // NONE is only meaningful on a parent-eligible question. We
                // allow it regardless of depth here; the server-side flow
                // trusts the tutor to only apply it to questions with children.
                .map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {!isContext && (
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Points</label>
            <Input
              type="number"
              min={0}
              className="h-9 w-24 tabular-nums"
              value={question.points}
              onChange={(e) => patch("points", Number(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-foreground text-xs font-medium">
          {isContext ? "Context text" : "Question"}
        </label>
        <Textarea
          rows={3}
          value={question.question}
          onChange={(e) => patch("question", e.target.value)}
          placeholder={
            isContext
              ? "Passage / instructions the sub-questions refer to..."
              : "What is the derivative of $x^2$?"
          }
        />
      </div>

      {!isContext && <TypeSpecificFields question={question} patch={patch} />}

      {question.subQuestions.length > 0 && (
        <div className="space-y-3 border-l-2 border-brand-terracotta/20 pl-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Sub-questions
          </p>
          {question.subQuestions.map((child, i) => {
            const childLabel =
              depth === 0
                ? `${label}.${SUB_LETTERS[i % SUB_LETTERS.length] ?? i + 1}`
                : `${label}.${i + 1}`;
            return (
              <TestQuestionEditor
                key={child.clientId}
                question={child}
                onChange={(next) => updateSub(i, next)}
                onRemove={() => removeSub(i)}
                onMoveUp={i > 0 ? () => moveSub(i, -1) : undefined}
                onMoveDown={
                  i < question.subQuestions.length - 1
                    ? () => moveSub(i, 1)
                    : undefined
                }
                label={childLabel}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSubQuestion}
        >
          <Plus className="size-3" /> Add sub-question
        </Button>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Type-specific field renderer                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function TypeSpecificFields({
  question,
  patch,
}: {
  question: EditorQuestion;
  patch: <K extends keyof EditorQuestion>(key: K, value: EditorQuestion[K]) => void;
}) {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "MULTI_SELECT":
      return (
        <OptionsEditor
          multi={question.type === "MULTI_SELECT"}
          options={question.options}
          answer={question.answer}
          onOptions={(v) => patch("options", v)}
          onAnswer={(v) => patch("answer", v)}
        />
      );
    case "TRUE_FALSE":
      return (
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Correct answer
          </label>
          <Select
            value={typeof question.answer === "string" ? question.answer : ""}
            onValueChange={(v) => patch("answer", v)}
          >
            <SelectTrigger className="max-w-40">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "SHORT_ANSWER":
    case "NUMERIC":
      return (
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Correct answer
          </label>
          <Input
            type={question.type === "NUMERIC" ? "number" : "text"}
            value={typeof question.answer === "string" ? question.answer : ""}
            onChange={(e) => patch("answer", e.target.value)}
            placeholder={question.type === "NUMERIC" ? "42" : "Expected answer"}
          />
        </div>
      );
    case "CODE":
      return (
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">Language</label>
          <Input
            value={question.language ?? ""}
            onChange={(e) => patch("language", e.target.value)}
            placeholder="typescript, python, ..."
          />
          <p className="text-muted-foreground text-xs">
            Code responses are graded manually; no key answer needed.
          </p>
        </div>
      );
    case "ESSAY":
    case "FILE_UPLOAD":
      return (
        <p className="text-muted-foreground text-xs italic">
          Graded manually by the tutor after submission.
        </p>
      );
    case "MATCHING":
      return (
        <MatchingEditor
          pairs={question.matchPairs}
          onChange={(v) => patch("matchPairs", v)}
        />
      );
    case "REORDER":
      return (
        <ReorderEditor
          items={question.reorderItems}
          onChange={(v) => patch("reorderItems", v)}
        />
      );
    case "FILL_IN_THE_BLANK":
      return (
        <FillBlanksEditor
          blankCount={question.blankCount ?? 1}
          answer={question.answer}
          onBlanks={(n) => patch("blankCount", n)}
          onAnswer={(v) => patch("answer", v)}
        />
      );
    default:
      return null;
  }
}

/* ─── OptionsEditor (MC + MS) ─── */

function OptionsEditor({
  multi,
  options,
  answer,
  onOptions,
  onAnswer,
}: {
  multi: boolean;
  options: string[];
  answer: unknown;
  onOptions: (v: string[]) => void;
  onAnswer: (v: unknown) => void;
}) {
  const selected: string[] = multi
    ? Array.isArray(answer) ? (answer as string[]) : []
    : typeof answer === "string" ? [answer] : [];

  function toggleAnswer(opt: string) {
    if (multi) {
      const set = new Set(selected);
      if (set.has(opt)) set.delete(opt);
      else set.add(opt);
      onAnswer(Array.from(set));
    } else {
      onAnswer(opt);
    }
  }

  function updateOption(i: number, v: string) {
    const before = options[i];
    const copy = options.slice();
    copy[i] = v;
    onOptions(copy);
    // If the correct answer referenced the old option text, migrate it.
    if (multi) {
      if (selected.includes(before)) {
        onAnswer(selected.map((s) => (s === before ? v : s)));
      }
    } else if (typeof answer === "string" && answer === before) {
      onAnswer(v);
    }
  }
  function removeOption(i: number) {
    const removed = options[i];
    onOptions(options.filter((_, j) => j !== i));
    if (multi) {
      onAnswer(selected.filter((s) => s !== removed));
    } else if (answer === removed) {
      onAnswer(null);
    }
  }
  function addOption() {
    onOptions([...options, ""]);
  }

  return (
    <div className="space-y-2">
      <label className="text-foreground text-xs font-medium">
        Options {multi ? "(check the correct answers)" : "(pick one as correct)"}
      </label>
      <ul className="space-y-2">
        {options.map((opt, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAnswer(opt)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center border transition-colors",
                multi ? "rounded-sm" : "rounded-full",
                selected.includes(opt)
                  ? "border-brand-terracotta bg-brand-terracotta"
                  : "border-muted-foreground/40",
              )}
              aria-label={selected.includes(opt) ? "Correct" : "Mark correct"}
            >
              {selected.includes(opt) &&
                (multi ? (
                  <svg
                    className="size-3 text-primary-foreground"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ))}
            </button>
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
              onClick={() => removeOption(i)}
              aria-label={`Remove option ${i + 1}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="size-3" /> Add option
      </Button>
    </div>
  );
}

/* ─── MatchingEditor ─── */

function MatchingEditor({
  pairs,
  onChange,
}: {
  pairs: Array<{ left: string; right: string }>;
  onChange: (v: Array<{ left: string; right: string }>) => void;
}) {
  function update(i: number, key: "left" | "right", v: string) {
    const copy = pairs.slice();
    copy[i] = { ...copy[i], [key]: v };
    onChange(copy);
  }
  function remove(i: number) {
    onChange(pairs.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...pairs, { left: "", right: "" }]);
  }
  return (
    <div className="space-y-2">
      <label className="text-foreground text-xs font-medium">
        Pairs (right column is shuffled for students)
      </label>
      <ul className="space-y-2">
        {pairs.map((p, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <Input
              value={p.left}
              onChange={(e) => update(i, "left", e.target.value)}
              placeholder="Left"
            />
            <span className="text-muted-foreground text-xs">→</span>
            <Input
              value={p.right}
              onChange={(e) => update(i, "right", e.target.value)}
              placeholder="Right"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
              onClick={() => remove(i)}
              aria-label={`Remove pair ${i + 1}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-3" /> Add pair
      </Button>
    </div>
  );
}

/* ─── ReorderEditor ─── */

function ReorderEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (v: string[]) => void;
}) {
  function update(i: number, v: string) {
    const copy = items.slice();
    copy[i] = v;
    onChange(copy);
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...items, ""]);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  return (
    <div className="space-y-2">
      <label className="text-foreground text-xs font-medium">
        Items in the correct order
      </label>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums w-5 text-xs">
              {i + 1}
            </span>
            <Input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Item ${i + 1}`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => move(i, -1)}
              disabled={i === 0}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
              onClick={() => remove(i)}
              aria-label={`Remove item ${i + 1}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-3" /> Add item
      </Button>
    </div>
  );
}

/* ─── FillBlanksEditor ─── */

function FillBlanksEditor({
  blankCount,
  answer,
  onBlanks,
  onAnswer,
}: {
  blankCount: number;
  answer: unknown;
  onBlanks: (n: number) => void;
  onAnswer: (v: unknown) => void;
}) {
  const arr = Array.isArray(answer)
    ? (answer as string[])
    : Array(blankCount).fill("");
  React.useEffect(() => {
    // Keep answer array length synced with blankCount.
    if (arr.length !== blankCount) {
      const next = Array.from({ length: blankCount }).map((_, i) => arr[i] ?? "");
      onAnswer(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blankCount]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">
            Blanks
          </label>
          <Input
            type="number"
            min={1}
            max={20}
            className="h-9 w-24 tabular-nums"
            value={blankCount}
            onChange={(e) => onBlanks(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-foreground text-xs font-medium">
          Correct answers (in order)
        </label>
        <ol className="space-y-2">
          {Array.from({ length: blankCount }).map((_, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground tabular-nums w-5 text-xs">
                {i + 1}
              </span>
              <Input
                value={arr[i] ?? ""}
                onChange={(e) => {
                  const copy = arr.slice();
                  copy[i] = e.target.value;
                  onAnswer(copy);
                }}
                placeholder={`Blank ${i + 1}`}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
