"use client";

/**
 * Shared parts of AI help for tutors (contracts/viewer.md): one run at a
 * time, what's left this month, the document to read, and the lines every
 * draft carries. A run's result stays until it's used or cleared, so closing
 * the dialog doesn't lose a draft that was paid for.
 */

import * as React from "react";
import { FileUp, Info, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NexusLoader } from "@/components/ui/nexus";
import { Textarea } from "@/components/ui/textarea";
import { getAiAssistStatus } from "@/features/ai-assist/actions";
import { AI_ASSIST_INPUT } from "@/features/ai-assist/limits";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, lessonAttachmentPath } from "@/lib/blob/paths";

import { AI_WAIT, leftText, type AiFeature, type AiHelp, type AiLeft } from "../lib/ai-help";

type ActionResult<T> = { data?: T; serverError?: string; validationErrors?: unknown } | undefined;

/** An action's data, or an error worth reading. */
export function aiData<T>(r: ActionResult<T>, fallback: string): T {
  if (r?.serverError) throw new Error(r.serverError);
  if (r?.data === undefined) throw new Error(r?.validationErrors ? "Some of what you filled in is too long or missing. Check it and try again." : fallback);
  return r.data;
}

export function useAiRun<T extends { allowance?: AiLeft }>() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<T | null>(null);

  const run = React.useCallback(async (call: () => Promise<T>) => {
    setPending(true);
    setError(null);
    try {
      const next = await call();
      setResult(next);
      return next;
    } catch (e) {
      // A dropped connection reads as "Failed to fetch"; say what it means.
      const text = e instanceof Error ? e.message : "";
      setError(!text || /fetch|network|unexpected response/i.test(text) ? "The draft didn't arrive. Check your connection and try again." : text);
      return null;
    } finally {
      setPending(false);
    }
  }, []);
  const clear = React.useCallback(() => {
    setResult(null);
    setError(null);
  }, []);
  return { pending, error, result, run, clear };
}

/** What's left this month, read when the dialog opens. Null while loading, or when it can't be read. */
export function useAiLeft(courseId: string, feature: AiFeature, open: boolean, load: (courseId: string) => Promise<Partial<Record<AiFeature, AiLeft>> | null> = loadLeft): AiLeft | null {
  const [left, setLeft] = React.useState<AiLeft | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    load(courseId)
      .then((f) => live && setLeft(f?.[feature] ?? null))
      .catch(() => live && setLeft(null));
    return () => {
      live = false;
    };
  }, [courseId, feature, open, load]);
  return left;
}

async function loadLeft(courseId: string) {
  return (await getAiAssistStatus({ courseId }))?.data?.features ?? null;
}

/** "8 of 10 left this month", and that a run spends credits. */
export function AiLeftLine({ feature, left, help }: { feature: AiFeature; left: AiLeft | null; help: AiHelp }) {
  const parts = [left ? leftText(feature, left) : null, help.credits ? "Each run uses AI credits" : null].filter(Boolean);
  return <p className="text-muted-foreground min-h-4 text-xs">{parts.join(" · ")}</p>;
}

/** While it works: the loader and how long to expect. */
export function AiWorking({ feature }: { feature: AiFeature }) {
  return (
    <div role="status" className="flex items-center gap-3 py-6">
      <NexusLoader size={28} label={null} />
      <p className="text-muted-foreground text-sm">{AI_WAIT[feature] ?? "Working on it."}</p>
    </div>
  );
}

export function AiError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
      {children}
    </p>
  );
}

/** The AI's own note on a draft: something to check. */
export function AiNote({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <p className="border-border bg-muted/40 text-foreground flex gap-2 rounded-md border p-3 text-sm">
      <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  );
}

/* ─── The document ──────────────────────────────────────────────────────── */

export type AiDocument = { text: string; file: { name: string; url: string } | null };
export const EMPTY_DOCUMENT: AiDocument = { text: "", file: null };

/** The document's fields for A's actions, or null when there's nothing to read. */
export function documentInput(d: AiDocument): { text?: string; fileUrl?: string } | null {
  const text = d.text.trim();
  if (!text && !d.file) return null;
  return { ...(text ? { text } : {}), ...(d.file ? { fileUrl: d.file.url } : {}) };
}

const MAX_MB = AI_ASSIST_INPUT.pdfBytes / (1024 * 1024);

/** Paste text, or choose a PDF (uploaded) or a text file (read here). */
export function DocumentField({ courseId, value, onChange, disabled }: {
  courseId: string;
  value: AiDocument;
  onChange: (next: AiDocument) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(file: File) {
    setError(null);
    if (file.size > AI_ASSIST_INPUT.pdfBytes) {
      setError(`That file is bigger than ${MAX_MB} MB. Use a smaller one, or paste the part you need.`);
      return;
    }
    setBusy(true);
    try {
      if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
        onChange({ ...value, text: (await file.text()).slice(0, AI_ASSIST_INPUT.documentChars) });
        return;
      }
      if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
        setError("Choose a PDF or a text file. For a Word document, save it as a PDF first.");
        return;
      }
      const { url } = await uploadFile({ kind: BlobKind.LessonAttachment, pathname: lessonAttachmentPath(courseId, "ai-drafts", file.name), file });
      onChange({ ...value, file: { name: file.name, url } });
    } catch {
      setError("The file didn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Document</Label>
      {value.file ? (
        <div className="border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <FileUp aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{value.file.name}</span>
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={disabled} aria-label={`Remove ${value.file.name}`} onClick={() => onChange({ ...value, file: null })}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
            {busy ? "Uploading…" : "Choose a file"}
          </Button>
          <span className="text-muted-foreground text-xs">A PDF or text file, up to {MAX_MB} MB</span>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void choose(file);
        }}
      />
      <Textarea
        id={id}
        rows={5}
        value={value.text}
        disabled={disabled}
        maxLength={AI_ASSIST_INPUT.documentChars}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder={value.file ? "Anything to add to the file (optional)" : "Or paste the text: a scheme of work, notes, or a chapter"}
        className="max-h-56"
      />
      {error ? <p role="alert" className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
