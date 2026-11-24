"use client";

/**
 * A report comment that saves itself: a moment after the last keystroke, on
 * leaving the box, and on the way off the page. One save at a time, and the
 * newest text always goes last.
 */

import * as React from "react";

import { useReadOnly } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { SaveState } from "@/components/ui/save-state";
import { Textarea } from "@/components/ui/textarea";

import { COMMENT_MAX } from "../../lib/term-report";
import { saveCourseComment, saveOverallComment } from "../../term-report-actions";

const DELAY_MS = 1200;

export type CommentTarget = { termId: string; learnerId: string; courseId: string | null };

type State = "idle" | "waiting" | "saving" | "saved" | "failed";

async function send(target: CommentTarget, text: string): Promise<string | null> {
  const { termId, learnerId, courseId } = target;
  const r = await (courseId ? saveCourseComment({ termId, learnerId, courseId, text }) : saveOverallComment({ termId, learnerId, text })).catch(() => null);
  if (r?.data) return null;
  return r?.serverError ?? "We couldn't save it. Check your connection.";
}

export function CommentBox({ target, initial, label, placeholder, save = send }: {
  target: CommentTarget;
  initial: string;
  /** The box's accessible name: "Comment for Lwazi Dube". */
  label: string;
  placeholder?: string;
  /** For samples. */
  save?: (target: CommentTarget, text: string) => Promise<string | null>;
}) {
  const readOnly = useReadOnly();
  const statusId = React.useId();
  const [text, setText] = React.useState(initial);
  const [state, setState] = React.useState<State>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const latest = React.useRef(initial);
  const stored = React.useRef(initial.trim());
  const busy = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (busy.current) return;
    busy.current = true;
    let failed: string | null = null;
    while (latest.current.trim() !== stored.current && !failed) {
      const sending = latest.current.trim();
      setState("saving");
      failed = await save(target, sending);
      if (!failed) {
        stored.current = sending;
        setSavedAt(new Date());
      }
    }
    busy.current = false;
    setError(failed);
    setState((s) => (failed ? "failed" : s === "idle" ? "idle" : "saved"));
  }, [save, target]);

  // Leaving by a link unmounts the box; closing the tab asks first.
  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (latest.current.trim() !== stored.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void flushRef.current();
    };
  }, []);

  function change(next: string) {
    latest.current = next;
    setText(next);
    setState("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DELAY_MS);
  }

  if (readOnly) return <p className="text-muted-foreground text-sm whitespace-pre-line">{initial || "No comment"}</p>;
  const left = COMMENT_MAX - text.length;
  return (
    <div className="space-y-1">
      <Textarea
        aria-label={label}
        aria-describedby={statusId}
        aria-invalid={state === "failed" || undefined}
        value={text}
        maxLength={COMMENT_MAX}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value)}
        onBlur={() => void flush()}
      />
      <div id={statusId} className="text-muted-foreground flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs">
        <SaveState kind={state === "waiting" ? "pending" : state} at={savedAt} error={error} quiet />
        {state === "failed" ? (
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void flush()}>
            Try again
          </Button>
        ) : left <= 100 ? (
          <span className="tabular-nums">{left} characters left</span>
        ) : null}
      </div>
    </div>
  );
}
