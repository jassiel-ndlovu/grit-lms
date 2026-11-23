"use client";

/**
 * A student's practice session (contracts/practice.md): one question at a
 * time, untimed, marked as soon as it's answered. A question that wasn't
 * fully right comes back at the end of the session, up to twice. Nothing
 * here counts for marks.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, Loader2, RotateCcw, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import LessonMarkdown from "@/app/components/markdown";
import { MathsAnswerText } from "@/components/content/answer-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { PracticeAnswerKey, PracticeNode } from "../lib/practice";
import { isAnswered } from "../lib/runner-state";
import { answerPractice } from "../practice-actions";
import { QuestionRenderer, type RendererQuestion } from "./question-renderer";

export type PracticeRunnerItem = { id: string; nodes: PracticeNode[] };

type Result = {
  share: number;
  parts: Record<string, boolean | null>;
  undecided: boolean;
  keys: PracticeAnswerKey[];
  saved: boolean;
};

/** How often one question may come back in a session. */
const MAX_REPEATS = 2;

function AnswerKey({ answer }: { answer: PracticeAnswerKey }) {
  if (answer.type === "MATCHING") {
    return (
      <ul className="space-y-1 text-sm">
        {answer.pairs.map((p) => (
          <li key={p.left} className="flex flex-wrap items-baseline gap-x-2">
            <LessonMarkdown content={p.left} className="prose-sm" />
            <span aria-hidden>→</span>
            <span className="sr-only">goes with</span>
            <LessonMarkdown content={p.right} className="prose-sm" />
          </li>
        ))}
      </ul>
    );
  }
  if (answer.type === "REORDER") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {answer.text.map((t, i) => (
          <li key={i}>
            <LessonMarkdown content={t} className="prose-sm" />
          </li>
        ))}
      </ol>
    );
  }
  if (answer.type === "MATH_EXPRESSION") return <MathsAnswerText tex={answer.text[0]} />;
  if (answer.type === "TRUE_FALSE") return <span className="text-sm capitalize">{answer.text[0]}</span>;
  if (answer.type === "MULTIPLE_CHOICE" || answer.type === "MULTI_SELECT") {
    return (
      <ul className="space-y-1 text-sm">
        {answer.text.map((t) => (
          <li key={t}>
            <LessonMarkdown content={t} className="prose-sm" />
          </li>
        ))}
      </ul>
    );
  }
  return <span className="text-sm">{answer.text.join("; ")}</span>;
}

export function PracticeRunner({ setId, items, backHref }: { setId: string; items: PracticeRunnerItem[]; backHref: string }) {
  // Positions in `items`; a question that comes back is added again at the end.
  const [queue, setQueue] = React.useState(() => items.map((_, i) => i));
  const [pos, setPos] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, setPending] = React.useState(false);
  /** First answer per question: fully right or not. */
  const [firstTry, setFirstTry] = React.useState<Record<string, boolean>>({});
  const heading = React.useRef<HTMLHeadingElement>(null);
  const feedback = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (pos > 0) heading.current?.focus();
  }, [pos]);
  React.useEffect(() => {
    if (result) feedback.current?.focus();
  }, [result]);

  const done = pos >= queue.length;
  const item = done ? null : items[queue[pos]];
  const seen = item ? queue.slice(0, pos).filter((q) => q === queue[pos]).length : 0;
  const answered = item ? item.nodes.some((n) => n.type !== "NONE" && isAnswered(answers[n.id])) : false;

  async function send(selfMark?: boolean, given: Record<string, unknown> = answers) {
    if (!item) return;
    setPending(true);
    const r = await answerPractice({ itemId: item.id, answers: given, selfMark }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? "Your answer wasn't saved. Check your connection and try again.");
      return;
    }
    const data = r.data;
    setResult(data);
    if (!data.saved) return;
    const right = data.share >= 1;
    setFirstTry((prev) => (item.id in prev ? prev : { ...prev, [item.id]: right }));
    if (!right && seen < MAX_REPEATS) setQueue((prev) => [...prev, prev[pos]]);
  }

  function next() {
    setAnswers({});
    setResult(null);
    setPos((p) => p + 1);
  }

  if (done) {
    const total = Object.keys(firstTry).length;
    const right = Object.values(firstTry).filter(Boolean).length;
    return (
      <Card className="mx-auto w-full max-w-2xl space-y-4 p-6 text-center">
        <CheckCircle2 aria-hidden className="text-success mx-auto size-10" />
        <h2 ref={heading} tabIndex={-1} className="text-foreground text-lg font-semibold outline-none">
          Session done
        </h2>
        <p className="text-muted-foreground text-sm">
          {right} of {total} right first time.{" "}
          {right < total ? "The ones you missed come back soon." : "They come back after longer and longer gaps."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft aria-hidden className="size-4" />
              Back to practice
            </Link>
          </Button>
          {/* A full load, so the page builds the next session from what's due now. */}
          <Button onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden className="size-4" />
            Keep going
          </Button>
        </div>
      </Card>
    );
  }
  if (!item) return null;

  const keys = new Map(result?.keys.map((k) => [k.id, k]));
  const judged = result !== null && result.saved;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <h2 ref={heading} tabIndex={-1} className="tabular-nums outline-none">
          Question {pos + 1} of {queue.length}
          {seen > 0 ? " · again" : ""}
        </h2>
        <span>Practice: no marks</span>
      </div>
      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={queue.length}
        aria-valuenow={pos}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full transition-[width] motion-reduce:transition-none" style={{ width: `${(pos / queue.length) * 100}%` }} />
      </div>

      <Card className="space-y-6 p-4 sm:p-6">
        {item.nodes.map((node) => {
          const right = result?.parts[node.id];
          const key = keys.get(node.id);
          return (
            <div
              key={`${item.id}:${seen}:${node.id}`}
              className={cn("space-y-3", node.depth > 0 && "border-border border-l-2 pl-4")}
              style={node.depth > 1 ? { marginLeft: `${(node.depth - 1) * 0.75}rem` } : undefined}
            >
              {node.question.trim() ? <LessonMarkdown content={node.question} /> : null}
              {node.type !== "NONE" ? (
                <QuestionRenderer
                  question={node as RendererQuestion}
                  value={answers[node.id]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [node.id]: v }))}
                  disabled={pending || result !== null}
                  testId={setId}
                  shuffleSeed={`${item.id}:${seen}`}
                />
              ) : null}
              {result && key ? (
                <div className="bg-muted/40 space-y-1 rounded-md p-3">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium",
                      right === true ? "text-success" : right === false ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {right === true ? <CheckCircle2 aria-hidden className="size-4" /> : right === false ? <XCircle aria-hidden className="size-4" /> : null}
                    {right === true ? "Right" : right === false ? "Not quite" : "Compare your answer"}
                  </p>
                  {right !== true ? (
                    <div className="text-foreground">
                      <p className="text-muted-foreground text-xs">Answer</p>
                      <AnswerKey answer={key} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {result === null ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setAnswers({});
                void send(undefined, {});
              }}
            >
              <Eye aria-hidden className="size-4" />
              Show answer
            </Button>
            <Button disabled={pending || !answered} onClick={() => send()}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              Check
            </Button>
          </div>
        ) : (
          <div ref={feedback} tabIndex={-1} role="status" className="flex flex-wrap items-center justify-between gap-3 outline-none">
            {judged ? (
              <>
                <p className="text-foreground text-sm">
                  {result.share >= 1
                    ? "All right. This one comes back later."
                    : seen < MAX_REPEATS
                      ? "You'll see this one again before the end."
                      : "This one comes back next time."}
                </p>
                <Button onClick={next}>
                  Next
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-foreground text-sm">We couldn&apos;t check your maths. Does it match the answer?</p>
                <span className="flex gap-2">
                  <Button variant="outline" disabled={pending} onClick={() => send(false)}>
                    <X aria-hidden className="size-4" />
                    No
                  </Button>
                  <Button disabled={pending} onClick={() => send(true)}>
                    <Check aria-hidden className="size-4" />
                    Yes
                  </Button>
                </span>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
