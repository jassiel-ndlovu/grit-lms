"use client";

/**
 * Tidy or simplify lesson text with AI (contracts/viewer.md), from the
 * editor. It works on whole blocks: the selected ones, or the lesson. The
 * tutor sees before and after; replacing is one step, so Undo brings the old
 * text back, and nothing is saved until they save the lesson.
 *
 * The AI reads and writes text, so blocks it can't carry (images, tables,
 * graphs, code) stop it rather than disappear.
 */

import * as React from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import LessonMarkdown from "@/app/components/markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReadOnly } from "@/components/shell/workspace-access";
import { tidyTextAction } from "@/features/ai-assist/actions";
import type { TidyDraft } from "@/features/ai-assist/assist";
import { AiError, AiLeftLine, AiWorking, aiData, useAiLeft, useAiRun } from "@/features/courses/components/ai-help";
import type { AiFeature, AiHelp, AiLeft } from "@/features/courses/lib/ai-help";
import { draftMarkdown, plainMaths, texParens } from "@/features/courses/lib/ai-text";
import { docToMarkdown, markdownToDoc } from "@/lib/content/markdown";
import { validateDoc } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

import { tidyProblem } from "../lib/ai-tidy";

type Mode = "tidy" | "simplify";
type TidyInput = { courseId: string; text: string; mode: Mode; readingLevel?: string };
type Picked = { from: number; to: number; text: string; whole: boolean; problem: string | null };

async function tidy(input: TidyInput): Promise<TidyDraft> {
  return aiData(await tidyTextAction(input), "The text didn't arrive. Try again.");
}

/** The selected blocks, or all of them. */
function pick(editor: Editor): Picked {
  const { selection, doc } = editor.state;
  const whole = selection.empty;
  const from = whole ? 0 : selection.$from.depth >= 1 ? selection.$from.before(1) : selection.from;
  const to = whole ? doc.content.size : selection.$to.depth >= 1 ? selection.$to.after(1) : selection.to;
  const content = (doc.slice(from, to).content.toJSON() ?? []) as JSONContent[];
  const text = texParens(docToMarkdown({ type: "doc", content: JSON.parse(JSON.stringify(content)) as JSONContent[] }));
  return { from, to, text, whole, problem: tidyProblem(content, text, whole) };
}

export function AiTidy({ editor, help, runWith = tidy, loadLeft }: {
  editor: Editor;
  help: AiHelp;
  /** For samples. */
  runWith?: (input: TidyInput) => Promise<TidyDraft>;
  loadLeft?: (courseId: string) => Promise<Partial<Record<AiFeature, AiLeft>> | null>;
}) {
  const id = React.useId();
  const readOnly = useReadOnly();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("tidy");
  const [level, setLevel] = React.useState("");
  const [picked, setPicked] = React.useState<Picked | null>(null);
  const ai = useAiRun<TidyDraft>();
  const left = useAiLeft(help.courseId, "TIDY", open, loadLeft);
  if (readOnly) return null;

  function start() {
    ai.clear();
    setPicked(pick(editor));
    setOpen(true);
  }

  function replace() {
    if (!picked || !ai.result) return;
    const doc = validateDoc(markdownToDoc(draftMarkdown(ai.result.text)));
    if (!doc?.content?.length) {
      toast.error("That text couldn't be put in the lesson. Try again, or copy it in yourself.");
      return;
    }
    editor.chain().focus().insertContentAt({ from: picked.from, to: picked.to }, doc.content).run();
    setOpen(false);
    ai.clear();
    toast.success("Text replaced. Save the lesson to keep it, or undo to get the old text back.");
  }

  const result = ai.result;
  return (
    <>
      {/* mousedown keeps the editor's selection. */}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={start}>
        <Sparkles className="size-3.5" /> Tidy or simplify with AI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn("flex max-h-[90dvh] flex-col", result ? "sm:max-w-4xl" : "sm:max-w-lg")}
          // Portals keep React events: a form submit here must not save the lesson.
          onSubmit={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{result ? "Compare before you replace" : "Tidy or simplify with AI"}</DialogTitle>
            <DialogDescription>
              {result
                ? "Check that the facts, steps and formulas are still right. Some formatting may change."
                : picked?.whole
                  ? "This works on the whole lesson. To change only a part, close this and select it first."
                  : "This works on the paragraphs you selected."}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1">
            {ai.pending ? (
              <AiWorking feature="TIDY" />
            ) : result ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Version label="Your text" text={picked?.text ?? ""} />
                  <Version label="New text" text={draftMarkdown(result.text)} />
                </div>
                {result.changes.length > 0 ? (
                  <div className="text-sm">
                    <p className="text-foreground font-medium">What changed</p>
                    <ul className="text-muted-foreground list-disc pl-5">
                      {result.changes.map((c) => (
                        <li key={c}>{plainMaths(c)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : picked?.problem ? (
              <p className="text-foreground text-sm">{picked.problem}</p>
            ) : (
              <>
                {ai.error ? <AiError>{ai.error}</AiError> : null}
                <div role="radiogroup" aria-label="What to do" className="space-y-2">
                  {(
                    [
                      ["tidy", "Tidy", "Fixes spelling, grammar and structure. Keeps your voice and length."],
                      ["simplify", "Simplify", "Shorter sentences and everyday words, with every fact and step kept."],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label key={value} className={cn("border-border flex cursor-pointer items-start gap-3 rounded-md border p-3", mode === value && "border-primary")}>
                      <input type="radio" name={`${id}-mode`} value={value} checked={mode === value} onChange={() => setMode(value)} className="accent-primary mt-1 size-4" />
                      <span className="text-sm">
                        <span className="text-foreground block font-medium">{label}</span>
                        <span className="text-muted-foreground block text-xs">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {mode === "simplify" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-level`}>
                      Who it&apos;s for <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id={`${id}-level`} value={level} maxLength={60} onChange={(e) => setLevel(e.target.value)} placeholder="Grade 8, English as a second language" />
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:items-center sm:justify-between">
            {result ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Keep my text
                </Button>
                <Button type="button" onClick={replace}>
                  Replace my text
                </Button>
              </>
            ) : picked?.problem ? (
              <Button type="button" variant="outline" className="sm:ml-auto" onClick={() => setOpen(false)}>
                Close
              </Button>
            ) : (
              <>
                <AiLeftLine feature="TIDY" left={left} help={help} />
                <Button
                  type="button"
                  disabled={ai.pending || !picked || left?.left === 0}
                  onClick={() =>
                    picked &&
                    void ai.run(() => runWith({ courseId: help.courseId, text: picked.text, mode, ...(mode === "simplify" && level.trim() ? { readingLevel: level.trim() } : {}) }))
                  }
                >
                  {mode === "tidy" ? "Tidy text" : "Simplify text"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Version({ label, text }: { label: string; text: string }) {
  return (
    <section aria-label={label} className="border-border min-w-0 rounded-md border">
      <p className="text-muted-foreground border-border border-b px-3 py-1.5 text-xs font-medium">{label}</p>
      <div className="max-h-[50dvh] overflow-y-auto p-3">
        <LessonMarkdown content={text} className="prose-sm" dynamic={false} />
      </div>
    </section>
  );
}
