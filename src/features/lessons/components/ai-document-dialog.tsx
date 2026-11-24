"use client";

/**
 * "Draft from a document" beside the lesson tree (contracts/viewer.md): an
 * outline (Plus), or lessons, tests and assignments (Pro). The tutor ticks
 * what to keep. Lessons have no draft state, so they reach students when
 * they're added, and the dialog says so; tests and assignments are added
 * unpublished.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import LessonMarkdown from "@/app/components/markdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lessonsFromDocumentAction, outlineFromDocumentAction } from "@/features/ai-assist/actions";
import type { OutlineDraft } from "@/features/ai-assist/assist";
import type { LessonsDraft } from "@/features/ai-assist/pro";
import { createSubmission } from "@/features/assignments/actions";
import { createTest } from "@/features/assessments/actions";
import { DraftQuestionCard } from "@/features/assessments/components/ai-questions-dialog";
import { assignmentBrief, lessonGroup, outlineGroups, testImport, type LessonGroupDraft } from "@/features/assessments/lib/ai-drafts";
import { parseTestJson, toCreateInput } from "@/features/assessments/lib/test-io";
import {
  AiError, AiLeftLine, AiNote, AiWorking, aiData, DocumentField, documentInput, EMPTY_DOCUMENT, useAiLeft, useAiRun, type AiDocument,
} from "@/features/courses/components/ai-help";
import type { AiFeature, AiHelp, AiLeft } from "@/features/courses/lib/ai-help";
import { draftMarkdown, plainMaths } from "@/features/courses/lib/ai-text";
import { cn } from "@/lib/utils";

import { createLessonsFromDraft } from "../actions";

type Kind = "outline" | "lessons";
type Result = { kind: "outline"; draft: OutlineDraft } | { kind: "lessons"; draft: LessonsDraft };
type RunInput =
  | { kind: "outline"; courseId: string; text?: string; fileUrl?: string }
  | { kind: "lessons"; courseId: string; text?: string; fileUrl?: string; lessons: number; tests: number; assignments: number; focus?: string };

async function read(input: RunInput): Promise<Result> {
  if (input.kind === "outline") {
    const { kind, ...rest } = input;
    return { kind, draft: aiData(await outlineFromDocumentAction(rest), "The outline didn't arrive. Try again.") };
  }
  const { kind, ...rest } = input;
  return { kind, draft: aiData(await lessonsFromDocumentAction({ ...rest, questionsPerTest: 8 }), "The drafts didn't arrive. Try again.") };
}

/** Saving goes through the same actions as the ordinary screens. */
export type DraftSaver = {
  lessons: (courseId: string, groups: LessonGroupDraft[]) => Promise<void>;
  test: (courseId: string, test: LessonsDraft["drafts"]["tests"][number]) => Promise<void>;
  assignment: (courseId: string, a: LessonsDraft["drafts"]["assignments"][number]) => Promise<void>;
};

const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const SAVER: DraftSaver = {
  async lessons(courseId, groups) {
    aiData(await createLessonsFromDraft({ courseId, groups }), "The lessons weren't added. Try again.");
  },
  async test(courseId, test) {
    aiData(await createTest(toCreateInput(parseTestJson(testImport(test, inAWeek())), courseId)), "The test wasn't added. Try again.");
  },
  async assignment(courseId, a) {
    aiData(await createSubmission({ ...assignmentBrief(a), courseId, dueDate: inAWeek(), isActive: false }), "The assignment wasn't added. Try again.");
  },
};

export function AiDocumentDialog({ help, runWith = read, saver = SAVER, loadLeft }: {
  help: AiHelp;
  /** For samples. */
  runWith?: (input: RunInput) => Promise<Result>;
  saver?: DraftSaver;
  loadLeft?: (courseId: string) => Promise<Partial<Record<AiFeature, AiLeft>> | null>;
}) {
  const id = React.useId();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("outline");
  const [doc, setDoc] = React.useState<AiDocument>(EMPTY_DOCUMENT);
  const [counts, setCounts] = React.useState({ lessons: "4", tests: "1", assignments: "0" });
  const [focus, setFocus] = React.useState("");
  /** Keys of what to keep: "0.2" in an outline; "l0", "t0", "a0" in drafts. */
  const [kept, setKept] = React.useState<Set<string>>(new Set());
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const ai = useAiRun<Result & { allowance?: AiLeft }>();
  const feature: AiFeature = kind === "outline" ? "OUTLINE" : "LESSONS";
  const left = useAiLeft(help.courseId, feature, open, loadLeft);

  const input = documentInput(doc);
  const result = ai.result;

  async function draft() {
    if (!input) return;
    const r = await ai.run(() =>
      runWith(
        kind === "outline"
          ? { kind, courseId: help.courseId, ...input }
          : {
              kind,
              courseId: help.courseId,
              ...input,
              lessons: clamp(counts.lessons, 1, 8),
              tests: clamp(counts.tests, 0, 2),
              assignments: clamp(counts.assignments, 0, 2),
              ...(focus.trim() ? { focus: focus.trim() } : {}),
            },
      ),
    );
    if (!r) return;
    setAdded(new Set());
    setKept(new Set(keysOf(r)));
  }

  function toggle(keys: string[], on: boolean) {
    setKept((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  const todo = [...kept].filter((k) => !added.has(k));

  async function add() {
    if (!result) return;
    setSaving(true);
    const done = new Set(added);
    const mark = (keys: string[]) => {
      for (const k of keys) done.add(k);
      setAdded(new Set(done));
    };
    try {
      if (result.kind === "outline") {
        const groups = outlineGroups(result.draft.outline.sections, (s, l) => todo.includes(`${s}.${l}`));
        await saver.lessons(help.courseId, groups);
        mark(todo);
      } else {
        const d = result.draft.drafts;
        const lessons = d.lessons.map((l, i) => ({ l, key: `l${i}` })).filter(({ key }) => todo.includes(key));
        if (lessons.length > 0) {
          await saver.lessons(help.courseId, [lessonGroup(lessons.map(({ l }) => l))]);
          mark(lessons.map(({ key }) => key));
        }
        for (const [i, t] of d.tests.entries()) {
          if (!todo.includes(`t${i}`)) continue;
          await saver.test(help.courseId, t);
          mark([`t${i}`]);
        }
        for (const [i, a] of d.assignments.entries()) {
          if (!todo.includes(`a${i}`)) continue;
          await saver.assignment(help.courseId, a);
          mark([`a${i}`]);
        }
      }
      toast.success(addedText([...todo]));
      setOpen(false);
      ai.clear();
      setDoc(EMPTY_DOCUMENT);
      router.refresh();
    } catch (e) {
      // What was added stays marked, so trying again doesn't add it twice.
      toast.error(e instanceof Error ? e.message : "Not everything was added. Check your connection and try again.");
      if (done.size > 0) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const lessonsToAdd = todo.filter((k) => !/^[ta]/.test(k)).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Draft from a document
      </Button>
      <DialogContent className={cn("flex max-h-[90dvh] flex-col", result ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{result ? "Choose what to keep" : "Draft from a document"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Check each draft: AI makes mistakes. You can edit everything after you add it."
              : "AI reads your scheme of work, notes or a chapter and drafts from it. Nothing is added until you've checked it."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1">
          {ai.pending ? (
            <AiWorking feature={feature} />
          ) : result ? (
            <>
              <AiNote>{result.kind === "outline" ? result.draft.outline.note : result.draft.drafts.note}</AiNote>
              {result.kind === "outline" ? (
                <OutlineReview draft={result.draft} kept={kept} disabled={saving} toggle={toggle} />
              ) : (
                <LessonsReview draft={result.draft} kept={kept} added={added} disabled={saving} toggle={toggle} />
              )}
            </>
          ) : (
            <>
              {ai.error ? <AiError>{ai.error}</AiError> : null}
              <div role="radiogroup" aria-label="What to draft" className="space-y-2">
                <KindOption name={id} value="outline" current={kind} onChange={setKind} label="An outline" hint="Sections and lesson titles with a short summary each, for you to fill in." />
                <KindOption
                  name={id}
                  value="lessons"
                  current={kind}
                  onChange={setKind}
                  disabled={!help.pro}
                  label="Lessons, tests and assignments"
                  hint={help.pro ? "Full lesson text, with tests and assignments to match." : "Part of the Pro plan for this course."}
                />
              </div>
              <DocumentField courseId={help.courseId} value={doc} onChange={setDoc} />
              {kind === "lessons" ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        ["lessons", "Lessons", 1, 8],
                        ["tests", "Tests", 0, 2],
                        ["assignments", "Assignments", 0, 2],
                      ] as const
                    ).map(([key, label, min, max]) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`${id}-${key}`}>{label}</Label>
                        <Input
                          id={`${id}-${key}`}
                          type="number"
                          inputMode="numeric"
                          min={min}
                          max={max}
                          value={counts[key]}
                          onChange={(e) => setCounts((c) => ({ ...c, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-focus`}>
                      Focus <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id={`${id}-focus`} value={focus} maxLength={300} onChange={(e) => setFocus(e.target.value)} placeholder="Only chapter 3, with exam-style examples" />
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          {result ? (
            <>
              <p className="text-muted-foreground text-xs">
                {[
                  lessonsToAdd > 0 ? "Students see the lessons as soon as you add them." : null,
                  todo.length > lessonsToAdd ? "Tests and assignments are added as drafts, due in a week: set the dates before you publish." : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={ai.clear}>
                  Start again
                </Button>
                <Button type="button" disabled={saving || todo.length === 0} onClick={add}>
                  {saving ? "Adding…" : addLabel(todo)}
                </Button>
              </div>
            </>
          ) : (
            <>
              <AiLeftLine feature={feature} left={left} help={help} />
              <Button type="button" disabled={!input || ai.pending || left?.left === 0} onClick={draft}>
                {kind === "outline" ? "Draft outline" : "Draft lessons"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const clamp = (s: string, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(s)) || 0));

function keysOf(r: Result): string[] {
  if (r.kind === "outline") return r.draft.outline.sections.flatMap((s, i) => s.lessons.map((_, j) => `${i}.${j}`));
  const d = r.draft.drafts;
  return [...d.lessons.map((_, i) => `l${i}`), ...d.tests.map((_, i) => `t${i}`), ...d.assignments.map((_, i) => `a${i}`)];
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

function parts(keys: string[]): string {
  const t = keys.filter((k) => k.startsWith("t")).length;
  const a = keys.filter((k) => k.startsWith("a")).length;
  const l = keys.length - t - a;
  const list = [l ? plural(l, "lesson") : null, t ? plural(t, "test") : null, a ? plural(a, "assignment") : null].filter((x): x is string => x !== null);
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}

const addLabel = (keys: string[]) => (keys.length === 0 ? "Add" : keys.every((k) => !/^[ta]/.test(k)) ? `Add ${parts(keys)}` : `Add ${plural(keys.length, "item")}`);
const addedText = (keys: string[]) => `${parts(keys)} added`;

function KindOption({ name, value, current, onChange, label, hint, disabled }: {
  name: string;
  value: Kind;
  current: Kind;
  onChange: (k: Kind) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("border-border flex items-start gap-3 rounded-md border p-3", current === value && "border-primary", disabled ? "opacity-70" : "cursor-pointer")}>
      <input type="radio" name={`${name}-kind`} value={value} checked={current === value} disabled={disabled} onChange={() => onChange(value)} className="accent-primary mt-1 size-4" />
      <span className="text-sm">
        <span className="text-foreground block font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  );
}

function OutlineReview({ draft, kept, disabled, toggle }: { draft: OutlineDraft; kept: Set<string>; disabled: boolean; toggle: (keys: string[], on: boolean) => void }) {
  const { outline } = draft;
  return (
    <div className="space-y-4">
      {outline.summary ? <p className="text-foreground text-sm">{plainMaths(outline.summary)}</p> : null}
      {outline.sections.map((s, i) => {
        const keys = s.lessons.map((_, j) => `${i}.${j}`);
        const on = keys.filter((k) => kept.has(k)).length;
        return (
          <section key={i} aria-label={plainMaths(s.title)} className="border-border rounded-lg border">
            <label className="bg-muted/40 flex items-start gap-3 rounded-t-lg px-4 py-3">
              <Checkbox className="mt-0.5" disabled={disabled} checked={on === keys.length ? true : on === 0 ? false : "indeterminate"} onCheckedChange={(v) => toggle(keys, v !== false)} />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-medium">{plainMaths(s.title)}</span>
                {s.objectives.length > 0 ? <span className="text-muted-foreground block text-xs">{s.objectives.map(plainMaths).join(" · ")}</span> : null}
              </span>
            </label>
            <ul className="divide-border divide-y">
              {s.lessons.map((l, j) => (
                <li key={j}>
                  <label className="flex items-start gap-3 px-4 py-2.5 pl-8">
                    <Checkbox className="mt-0.5" disabled={disabled} checked={kept.has(keys[j])} onCheckedChange={(v) => toggle([keys[j]], v === true)} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="text-foreground block">{plainMaths(l.title)}</span>
                      <span className="text-muted-foreground block text-xs">{plainMaths(l.summary)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LessonsReview({ draft, kept, added, disabled, toggle }: {
  draft: LessonsDraft;
  kept: Set<string>;
  added: Set<string>;
  disabled: boolean;
  toggle: (keys: string[], on: boolean) => void;
}) {
  const d = draft.drafts;
  const row = (key: string, title: string, meta: string, body: React.ReactNode) => (
    <li key={key} className="border-border rounded-lg border">
      <div className="flex items-start gap-3 px-4 py-3">
        <Checkbox
          className="mt-0.5"
          aria-label={`Keep ${title}`}
          disabled={disabled || added.has(key)}
          checked={kept.has(key)}
          onCheckedChange={(v) => toggle([key], v === true)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{meta}</p>
        </div>
        {added.has(key) ? (
          <span className="text-success flex items-center gap-1 text-xs font-medium">
            <Check aria-hidden className="size-3.5" /> Added
          </span>
        ) : null}
      </div>
      <details className="border-border border-t">
        <summary className="text-foreground cursor-pointer px-4 py-2 text-xs font-medium">Read it</summary>
        <div className="space-y-3 px-4 pb-4">{body}</div>
      </details>
    </li>
  );
  return (
    <ul className="space-y-3">
      {d.lessons.map((l, i) => row(`l${i}`, plainMaths(l.title), `Lesson · ${plainMaths(l.summary)}`, <LessonMarkdown content={draftMarkdown(l.body)} className="prose-sm" dynamic={false} />))}
      {d.tests.map((t, i) =>
        row(
          `t${i}`,
          plainMaths(t.title),
          `Test · ${plural(t.questions.length, "question")}`,
          <ol className="space-y-3">
            {t.questions.map((q, j) => (
              <li key={j}>
                <DraftQuestionCard draft={q} number={j + 1} checked />
              </li>
            ))}
          </ol>,
        ),
      )}
      {d.assignments.map((a, i) => {
        const brief = assignmentBrief(a);
        return row(
          `a${i}`,
          brief.title,
          `Assignment · ${plural(brief.totalPoints, "mark")}`,
          <>
            <LessonMarkdown content={brief.description} className="prose-sm" dynamic={false} />
            {a.modelAnswer.trim() ? (
              <div className="border-success/30 bg-success/5 space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-success text-xs font-medium">Memo, only for you</p>
                  <CopyButton text={a.modelAnswer} />
                </div>
                <LessonMarkdown content={a.modelAnswer} className="prose-sm" dynamic={false} />
                <p className="text-muted-foreground text-xs">The memo isn&apos;t added to the assignment. Copy it if you want to keep it.</p>
              </div>
            ) : null}
          </>,
        );
      })}
    </ul>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => toast.success("Memo copied"))
          .catch(() => toast.error("The memo wasn't copied. Select the text and copy it yourself."))
      }
    >
      <Copy className="size-3.5" /> Copy memo
    </Button>
  );
}
