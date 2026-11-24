"use client";

/**
 * "Draft with AI" in the test designer (contracts/viewer.md, "AI help for
 * tutors"): questions from a lesson or a topic. The tutor ticks the ones to
 * keep; they're copied into the test, where they're edited like any other.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";

import LessonMarkdown from "@/app/components/markdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateQuestionsAction } from "@/features/ai-assist/actions";
import { AI_ASSIST_INPUT } from "@/features/ai-assist/limits";
import type { QuestionDrafts } from "@/features/ai-assist/assist";
import { AiError, AiLeftLine, AiNote, AiWorking, aiData, useAiLeft, useAiRun } from "@/features/courses/components/ai-help";
import type { AiHelpWithLessons, AiLeft, AiFeature } from "@/features/courses/lib/ai-help";
import { cn } from "@/lib/utils";

import { draftToQuestion, type DraftQuestion } from "../lib/ai-drafts";
import type { ImportQuestion } from "../lib/test-io";
import { TYPE_LABELS } from "./test-question-editor";

const TYPES = ["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC", "ESSAY"] as const;
type DraftType = (typeof TYPES)[number];
const DIFFICULTIES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;
type Difficulty = (typeof DIFFICULTIES)[number][0];
const TOPIC_ONLY = "__topic__";

type Input = { courseId: string; lessonId?: string; topic?: string; count: number; types: DraftType[]; difficulty: Difficulty };

async function generate(input: Input): Promise<QuestionDrafts> {
  return aiData(await generateQuestionsAction(input), "The questions didn't arrive. Try again.");
}

export function AiQuestionsDialog({ help, onAdd, runWith = generate, loadLeft }: {
  help: AiHelpWithLessons;
  onAdd: (nodes: ImportQuestion[]) => void;
  /** For samples. */
  runWith?: (input: Input) => Promise<QuestionDrafts>;
  loadLeft?: (courseId: string) => Promise<Partial<Record<AiFeature, AiLeft>> | null>;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [lessonId, setLessonId] = React.useState(TOPIC_ONLY);
  const [topic, setTopic] = React.useState("");
  const [count, setCount] = React.useState("5");
  const [types, setTypes] = React.useState<DraftType[]>(["MULTIPLE_CHOICE", "NUMERIC", "ESSAY"]);
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium");
  const [kept, setKept] = React.useState<Set<number>>(new Set());
  const ai = useAiRun<QuestionDrafts>();
  const left = useAiLeft(help.courseId, "QUESTIONS", open, loadLeft);

  // Another course: its lessons differ, and so does the draft.
  const { clear } = ai;
  React.useEffect(() => {
    setLessonId(TOPIC_ONLY);
    clear();
  }, [help.courseId, clear]);

  const n = Math.min(AI_ASSIST_INPUT.maxQuestions, Math.max(1, Math.floor(Number(count)) || 0));
  const ready = types.length > 0 && Number(count) >= 1 && (lessonId !== TOPIC_ONLY || topic.trim().length > 0);

  async function draft() {
    const r = await ai.run(() =>
      runWith({
        courseId: help.courseId,
        ...(lessonId !== TOPIC_ONLY ? { lessonId } : {}),
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        count: n,
        types,
        difficulty,
      }),
    );
    if (r) setKept(new Set(r.questions.map((_, i) => i)));
  }

  function add() {
    const nodes = (ai.result?.questions ?? []).filter((_, i) => kept.has(i)).map((q) => draftToQuestion(q).node);
    onAdd(nodes);
    ai.clear();
    setOpen(false);
  }

  const result = ai.result;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" /> Draft with AI
      </Button>
      <DialogContent className={cn("flex max-h-[90dvh] flex-col", result ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{result ? "Choose the questions to keep" : "Draft questions with AI"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Check each question and its answer: AI makes mistakes. The ones you tick are added to this test, where you can edit them."
              : "Choose a lesson, or describe a topic. Nothing is added to the test until you've checked the questions."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1">
          {ai.pending ? (
            <AiWorking feature="QUESTIONS" />
          ) : result ? (
            <>
              <AiNote>{result.note}</AiNote>
              <ol className="space-y-3">
                {result.questions.map((q, i) => (
                  <li key={i}>
                    <DraftQuestionCard
                      draft={q}
                      number={i + 1}
                      checked={kept.has(i)}
                      onCheckedChange={(on) =>
                        setKept((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                    />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              {ai.error ? <AiError>{ai.error}</AiError> : null}
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-lesson`}>Lesson</Label>
                <Select value={lessonId} onValueChange={setLessonId}>
                  <SelectTrigger id={`${id}-lesson`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TOPIC_ONLY}>No lesson, just a topic</SelectItem>
                    {help.lessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-topic`}>
                  Topic{lessonId !== TOPIC_ONLY ? <span className="text-muted-foreground font-normal"> (optional)</span> : null}
                </Label>
                <Input
                  id={`${id}-topic`}
                  value={topic}
                  maxLength={300}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={lessonId === TOPIC_ONLY ? "Factorising quadratic trinomials" : "The part of the lesson to ask about"}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-count`}>How many (up to {AI_ASSIST_INPUT.maxQuestions})</Label>
                  <Input id={`${id}-count`} type="number" inputMode="numeric" min={1} max={AI_ASSIST_INPUT.maxQuestions} value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-difficulty`}>Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger id={`${id}-difficulty`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-foreground text-sm font-medium">Types of question</legend>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {TYPES.map((t) => (
                    <label key={t} className="flex min-h-6 items-center gap-2 text-sm">
                      <Checkbox
                        checked={types.includes(t)}
                        onCheckedChange={(on) => setTypes((prev) => (on ? [...prev, t] : prev.filter((x) => x !== t)))}
                      />
                      {TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          {result ? (
            <>
              <Button type="button" variant="ghost" onClick={ai.clear}>
                Start again
              </Button>
              <Button type="button" disabled={kept.size === 0} onClick={add}>
                {kept.size === 0 ? "Add questions" : `Add ${kept.size} ${kept.size === 1 ? "question" : "questions"}`}
              </Button>
            </>
          ) : (
            <>
              <AiLeftLine feature="QUESTIONS" left={left} help={help} />
              <Button type="button" disabled={!ready || ai.pending || left?.left === 0} onClick={draft}>
                Draft {n} {n === 1 ? "question" : "questions"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One drafted question with its answer, to keep or leave out. */
export function DraftQuestionCard({ draft, number, checked, onCheckedChange, disabled }: {
  draft: DraftQuestion;
  number: number;
  checked: boolean;
  onCheckedChange?: (on: boolean) => void;
  disabled?: boolean;
}) {
  const { node, marked, todo } = draftToQuestion(draft);
  const answers = Array.isArray(node.answer) ? (node.answer as string[]) : typeof node.answer === "string" ? [node.answer] : [];
  const hasOptions = (node.options ?? []).length > 0;
  return (
    <div className={cn("border-border rounded-lg border p-4", !checked && onCheckedChange && "opacity-70")}>
      <div className="flex gap-3">
        {onCheckedChange ? (
          <Checkbox className="mt-1" checked={checked} disabled={disabled} onCheckedChange={(on) => onCheckedChange(on === true)} aria-label={`Keep question ${number}`} />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-muted-foreground text-xs">
            {number} · {node.type === "ESSAY" ? "Written answer" : TYPE_LABELS[node.type]} · {node.points} {node.points === 1 ? "mark" : "marks"} ·{" "}
            {marked === "nexa" ? "marked automatically" : "you mark it"}
          </p>
          <LessonMarkdown content={node.question} className="prose-sm" dynamic={false} />
          {hasOptions ? (
            <ul className="space-y-1">
              {(node.options ?? []).map((o) => {
                const right = answers.includes(o);
                return (
                  <li key={o} className={cn("flex gap-2 rounded-md px-2 py-1 text-sm", right && "bg-success/10")}>
                    <span className="text-success w-14 shrink-0 text-xs leading-7 font-medium">{right ? "Correct" : ""}</span>
                    <div className="min-w-0 flex-1">
                      <LessonMarkdown content={o} className="prose-sm [&_p]:my-0!" dynamic={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : answers.length > 0 ? (
            <div className="border-success/30 bg-success/5 rounded-md border p-3">
              <p className="text-success mb-1 text-xs font-medium">{marked === "nexa" ? "Correct answer" : "Memo"}</p>
              <LessonMarkdown content={node.type === "TRUE_FALSE" ? (answers[0] === "true" ? "True" : "False") : answers[0]} className="prose-sm" dynamic={false} />
            </div>
          ) : null}
          {marked === "nexa" && draft.explanation.trim() ? (
            <div className="text-muted-foreground text-sm">
              <LessonMarkdown content={draft.explanation} className="prose-sm" dynamic={false} />
            </div>
          ) : null}
          {todo ? <p className="text-warning text-xs font-medium">{todo}</p> : null}
        </div>
      </div>
    </div>
  );
}
