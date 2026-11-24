"use client";

/**
 * "Draft a comment" beside a written answer while marking (Pro;
 * contracts/viewer.md). The draft opens under the comment box to edit first;
 * a suggested mark is only ever shown, the tutor enters the mark.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { feedbackDraftAction } from "@/features/ai-assist/actions";
import { AI_ASSIST_INPUT } from "@/features/ai-assist/limits";
import type { FeedbackDraft } from "@/features/ai-assist/pro";
import { AiError, AiWorking, aiData, useAiRun } from "@/features/courses/components/ai-help";
import { leftText } from "@/features/courses/lib/ai-help";

import { feedbackText } from "../lib/ai-drafts";

export type FeedbackInput = {
  courseId: string;
  question: string;
  answer: string;
  memo?: string;
  maxPoints?: number;
  tone?: "warm" | "direct";
  studentUserId?: string;
};

/** Whose answer, on which course. `load` is for samples. */
export type FeedbackContext = { courseId: string; studentUserId: string | null; load?: (input: FeedbackInput) => Promise<FeedbackDraft> };

async function draftFeedback(input: FeedbackInput): Promise<FeedbackDraft> {
  return aiData(await feedbackDraftAction(input), "The comment didn't arrive. Try again.");
}

const WRITTEN = new Set(["ESSAY", "SHORT_ANSWER", "CODE"]);

/** Long enough to say something about, and typed rather than uploaded. */
export function canDraftFeedback(type: string, answer: unknown): answer is string {
  return WRITTEN.has(type) && typeof answer === "string" && answer.trim().length >= 10 && answer.trim().length <= AI_ASSIST_INPUT.answerChars;
}

export function AiFeedback({ context, path, question, answer, memo, maxPoints, hasComment, disabled, onUse }: {
  context: FeedbackContext;
  /** The question's number, for names. */
  path: string;
  question: string;
  answer: string;
  memo: string;
  maxPoints: number;
  hasComment: boolean;
  disabled?: boolean;
  /** The edited comment. */
  onUse: (text: string) => void;
}) {
  const id = React.useId();
  const ai = useAiRun<FeedbackDraft>();
  const [text, setText] = React.useState("");

  async function draft() {
    const r = await ai.run(() =>
      (context.load ?? draftFeedback)({
        courseId: context.courseId,
        question: question.slice(0, 6000),
        answer,
        ...(memo.trim() ? { memo: memo.slice(0, 6000) } : {}),
        ...(maxPoints > 0 ? { maxPoints } : {}),
        tone: "warm",
        ...(context.studentUserId ? { studentUserId: context.studentUserId } : {}),
      }),
    );
    if (r) setText(feedbackText(r));
  }

  if (ai.pending) return <AiWorking feature="FEEDBACK" />;
  const result = ai.result;
  if (!result) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={draft} aria-label={`Draft a comment with AI on question ${path}`}>
          <Sparkles className="size-3.5" /> Draft a comment with AI
        </Button>
        {ai.error ? <AiError>{ai.error}</AiError> : null}
      </div>
    );
  }
  return (
    <section aria-label={`Drafted comment for question ${path}`} className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs">
          Drafted comment: check it against the answer
        </Label>
        <Textarea id={id} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {result.strengths.length > 0 ? (
        <div className="text-xs">
          <p className="text-foreground font-medium">What the answer does well</p>
          <ul className="text-muted-foreground list-disc pl-5">
            {result.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.suggestedMark !== null ? (
        <p className="text-muted-foreground text-xs">
          Suggested mark: <span className="text-foreground tabular-nums">{result.suggestedMark} out of {maxPoints}</span>. You decide the mark.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{leftText("FEEDBACK", result.allowance)}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={ai.clear}>
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !text.trim()}
            onClick={() => {
              onUse(text.trim());
              ai.clear();
            }}
          >
            {hasComment ? "Add to my comment" : "Use as comment"}
          </Button>
        </div>
      </div>
    </section>
  );
}
