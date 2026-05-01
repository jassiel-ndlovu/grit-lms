"use client";

/**
 * QuestionRenderer — switch-on-type renderer for a single TestQuestion.
 *
 * The runner owns answer state and passes (value, onChange) here. We keep the
 * renderer dumb on purpose: every concrete input is an Inkwell-styled
 * primitive, no per-question side-effects, no fetches.
 *
 * Answer shapes vary by type, so `value` is unknown here and the runner
 * uses the matching schema entry to coerce.
 */

import * as React from "react";
import { Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, sanitizeFilename } from "@/lib/blob/paths";
import { cn } from "@/lib/utils";

type QuestionType =
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
  | "NUMERIC";

export interface RendererQuestion {
  id: string;
  question: string;
  type: QuestionType;
  points: number;
  options: string[];
  language: string | null;
  matchPairs: unknown;
  reorderItems: string[];
  blankCount: number | null;
}

export interface QuestionRendererProps {
  question: RendererQuestion;
  /** The current answer for this question (any shape; type-specific). */
  value: unknown;
  onChange: (next: unknown) => void;
  /** Lock inputs while submitting / past expiry. */
  disabled?: boolean;
  /** Test id used to scope file-upload paths. */
  testId: string;
}

export function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.type) {
    case "MULTIPLE_CHOICE":
      return <MultipleChoice {...props} />;
    case "TRUE_FALSE":
      return <TrueFalse {...props} />;
    case "SHORT_ANSWER":
      return <ShortAnswer {...props} />;
    case "NUMERIC":
      return <Numeric {...props} />;
    case "ESSAY":
    case "CODE":
      return <LongText {...props} />;
    case "MULTI_SELECT":
      return <MultiSelect {...props} />;
    case "FILL_IN_THE_BLANK":
      return <FillInTheBlank {...props} />;
    case "REORDER":
      return <Reorder {...props} />;
    case "MATCHING":
      return <Matching {...props} />;
    case "FILE_UPLOAD":
      return <FileUpload {...props} />;
    default:
      return (
        <p className="text-muted-foreground italic text-sm">
          Unsupported question type.
        </p>
      );
  }
}

/* ─── MULTIPLE_CHOICE ─────────────────────────────────────────────────── */

function MultipleChoice({ question, value, onChange, disabled }: QuestionRendererProps) {
  const selected = typeof value === "string" ? value : "";
  return (
    <div className="space-y-2">
      {question.options.map((opt) => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
              active
                ? "border-brand-terracotta bg-brand-terracotta/8 text-foreground"
                : "border-border hover:border-brand-terracotta/40 bg-card",
              disabled && "opacity-60",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border",
                active
                  ? "border-brand-terracotta bg-brand-terracotta"
                  : "border-muted-foreground/40",
              )}
            >
              {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TRUE_FALSE ──────────────────────────────────────────────────────── */

function TrueFalse({ value, onChange, disabled }: QuestionRendererProps) {
  const sel = typeof value === "string" ? value : "";
  return (
    <div className="grid grid-cols-2 gap-3">
      {["true", "false"].map((opt) => {
        const active = sel === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md border px-4 py-3 text-sm font-medium capitalize transition-colors",
              active
                ? "border-brand-terracotta bg-brand-terracotta/8 text-foreground"
                : "border-border hover:border-brand-terracotta/40 bg-card",
              disabled && "opacity-60",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─── SHORT_ANSWER ────────────────────────────────────────────────────── */

function ShortAnswer({ value, onChange, disabled }: QuestionRendererProps) {
  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Your answer..."
    />
  );
}

/* ─── NUMERIC ─────────────────────────────────────────────────────────── */

function Numeric({ value, onChange, disabled }: QuestionRendererProps) {
  return (
    <Input
      type="number"
      value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      disabled={disabled}
      placeholder="0"
    />
  );
}

/* ─── ESSAY / CODE (long text) ───────────────────────────────────────── */

function LongText({ question, value, onChange, disabled }: QuestionRendererProps) {
  const isCode = question.type === "CODE";
  return (
    <Textarea
      rows={isCode ? 12 : 8}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={isCode ? "// Write your code here" : "Write your answer..."}
      className={cn(isCode && "font-mono text-sm")}
    />
  );
}

/* ─── MULTI_SELECT ───────────────────────────────────────────────────── */

function MultiSelect({ question, value, onChange, disabled }: QuestionRendererProps) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }
  return (
    <div className="space-y-2">
      {question.options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
              active
                ? "border-brand-terracotta bg-brand-terracotta/8 text-foreground"
                : "border-border hover:border-brand-terracotta/40 bg-card",
              disabled && "opacity-60",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-sm border",
                active
                  ? "border-brand-terracotta bg-brand-terracotta"
                  : "border-muted-foreground/40",
              )}
            >
              {active && (
                <svg className="size-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─── FILL_IN_THE_BLANK ──────────────────────────────────────────────── */

function FillInTheBlank({ question, value, onChange, disabled }: QuestionRendererProps) {
  const blanks = question.blankCount ?? 1;
  const arr = Array.isArray(value) ? (value as string[]) : Array(blanks).fill("");
  function update(i: number, next: string) {
    const copy = [...arr];
    copy[i] = next;
    onChange(copy);
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: blanks }).map((_, i) => (
        <Input
          key={i}
          type="text"
          value={arr[i] ?? ""}
          onChange={(e) => update(i, e.target.value)}
          disabled={disabled}
          placeholder={`Blank ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ─── REORDER ────────────────────────────────────────────────────────── */

function Reorder({ question, value, onChange, disabled }: QuestionRendererProps) {
  const order = Array.isArray(value) && value.length > 0
    ? (value as string[])
    : [...question.reorderItems];

  function move(idx: number, dir: -1 | 1) {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }

  return (
    <ol className="space-y-2">
      {order.map((item, i) => (
        <li
          key={`${i}-${item}`}
          className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground tabular-nums w-5 text-xs">{i + 1}</span>
          <span className="flex-1 text-foreground">{item}</span>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => move(i, -1)} disabled={disabled || i === 0}>
              ↑
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => move(i, 1)} disabled={disabled || i === order.length - 1}>
              ↓
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ─── MATCHING ───────────────────────────────────────────────────────── */

function Matching({ question, value, onChange, disabled }: QuestionRendererProps) {
  const pairs = (question.matchPairs ?? []) as Array<{ left: string; right: string }>;
  const leftItems = pairs.map((p) => p.left);
  const rightOptions = Array.from(new Set(pairs.map((p) => p.right)));

  const current = Array.isArray(value) ? (value as Array<{ left: string; right: string }>) : [];
  function setRight(left: string, right: string) {
    const filtered = current.filter((p) => p.left !== left);
    onChange([...filtered, { left, right }]);
  }
  function getRight(left: string) {
    return current.find((p) => p.left === left)?.right ?? "";
  }

  return (
    <div className="space-y-2">
      {leftItems.map((left) => (
        <div key={left} className="grid grid-cols-2 items-center gap-3 rounded-md border border-border bg-card p-3">
          <span className="text-sm text-foreground">{left}</span>
          <select
            value={getRight(left)}
            onChange={(e) => setRight(left, e.target.value)}
            disabled={disabled}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">Select match</option>
            {rightOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/* ─── FILE_UPLOAD ────────────────────────────────────────────────────── */

function FileUpload({ question, value, onChange, disabled, testId }: QuestionRendererProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  type UploadedAnswer = { fileUrl: string; fileType: string; fileName: string };
  const current = (value && typeof value === "object" && "fileUrl" in (value as object))
    ? (value as UploadedAnswer)
    : null;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadFile({
        kind: BlobKind.TestQuestionImage,
        pathname: `tests/${testId}/questions/${question.id}/${sanitizeFilename(file.name)}`,
        file,
      });
      onChange({
        fileUrl: url,
        fileType: file.type || "OTHER",
        fileName: file.name,
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      {current ? (
        <Card className="flex items-center gap-3 p-3">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md">
            <Upload className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{current.fileName}</p>
            <a href={current.fileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs">
              Open file
            </a>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="border-input bg-muted/30 hover:border-brand-terracotta/40 flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="text-brand-terracotta size-5 animate-spin" />
          ) : (
            <Upload className="text-brand-terracotta size-5" />
          )}
          <p className="text-muted-foreground">
            {uploading ? "Uploading..." : "Click to upload a file"}
          </p>
        </button>
      )}
    </div>
  );
}
