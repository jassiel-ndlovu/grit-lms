"use client";

/**
 * Draft report comments for a class (Pro; contracts/viewer.md): choose the
 * students, add a note about each if you like, then edit the drafts and save
 * the ones you want. Saving one fills in its box on the page.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useReadOnly } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportCommentsAction } from "@/features/ai-assist/actions";
import { AI_ASSIST_INPUT } from "@/features/ai-assist/limits";
import type { reportCommentDrafts } from "@/features/ai-assist/pro";
import { AiError, AiLeftLine, AiWorking, aiData, useAiLeft, useAiRun } from "@/features/courses/components/ai-help";
import type { AiFeature, AiHelp, AiLeft } from "@/features/courses/lib/ai-help";
import { plainMaths } from "@/features/courses/lib/ai-text";
import { cn } from "@/lib/utils";

import { COMMENT_MAX } from "../../lib/term-report";
import { announceComment, sendComment, type CommentTarget } from "./comment-box";

/** `mark` is the report's own mark in words, to check a draft against. */
export type CommentStudent = { learnerId: string; name: string; hasComment: boolean; mark?: string };
type Drafts = Awaited<ReturnType<typeof reportCommentDrafts>>;
type RunInput = {
  courseId: string;
  from: Date;
  to: Date;
  term: string;
  learnerIds: string[];
  notes: Record<string, string>;
  tone: "warm" | "formal";
};

async function draftComments(input: RunInput): Promise<Drafts> {
  return aiData(await reportCommentsAction(input), "The comments didn't arrive. Try again.");
}

export function AiComments({ help, term, students, runWith = draftComments, save = sendComment, loadLeft }: {
  help: AiHelp;
  /** `from` and `to` bound the term, as ISO times; `to` is exclusive. */
  term: { id: string; title: string; from: string; to: string };
  students: CommentStudent[];
  /** For samples. */
  runWith?: (input: RunInput) => Promise<Drafts>;
  save?: (target: CommentTarget, text: string) => Promise<string | null>;
  loadLeft?: (courseId: string) => Promise<Partial<Record<AiFeature, AiLeft>> | null>;
}) {
  const id = React.useId();
  const readOnly = useReadOnly();
  const max = AI_ASSIST_INPUT.reportStudents;
  const [open, setOpen] = React.useState(false);
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set(students.filter((s) => !s.hasComment).slice(0, max).map((s) => s.learnerId)));
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [tone, setTone] = React.useState<"warm" | "formal">("warm");
  const [texts, setTexts] = React.useState<Record<string, string>>({});
  const [kept, setKept] = React.useState<Set<string>>(new Set());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  /** Students given a comment here, since the page loaded. */
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const ai = useAiRun<Drafts>();
  const left = useAiLeft(help.courseId, "REPORT_COMMENTS", open, loadLeft);
  if (readOnly || students.length === 0) return null;

  const hasComment = (learnerId: string) => done.has(learnerId) || Boolean(students.find((s) => s.learnerId === learnerId)?.hasComment);

  function flip(set: React.Dispatch<React.SetStateAction<Set<string>>>, learnerId: string, on: boolean) {
    set((prev) => {
      const next = new Set(prev);
      if (on) next.add(learnerId);
      else next.delete(learnerId);
      return next;
    });
  }

  async function draft() {
    const learnerIds = students.filter((s) => chosen.has(s.learnerId)).map((s) => s.learnerId);
    const r = await ai.run(() =>
      runWith({
        courseId: help.courseId,
        from: new Date(term.from),
        to: new Date(term.to),
        term: term.title,
        learnerIds,
        notes: Object.fromEntries(learnerIds.filter((l) => notes[l]?.trim()).map((l) => [l, notes[l].trim()])),
        tone,
      }),
    );
    if (!r) return;
    const written = r.comments.filter((c) => c.comment.trim());
    setTexts(Object.fromEntries(written.map((c) => [c.learnerId, plainMaths(c.comment).trim()])));
    setKept(new Set(written.map((c) => c.learnerId)));
    setErrors({});
  }

  async function saveKept() {
    setSaving(true);
    const failed: Record<string, string> = {};
    let saved = 0;
    for (const learnerId of kept) {
      const target = { termId: term.id, learnerId, courseId: help.courseId };
      const text = (texts[learnerId] ?? "").trim();
      const error = await save(target, text);
      if (error) failed[learnerId] = error;
      else {
        saved++;
        announceComment(target, text);
        flip(setDone, learnerId, true);
      }
    }
    setSaving(false);
    setErrors(failed);
    setKept(new Set(Object.keys(failed)));
    if (saved > 0) toast.success(saved === 1 ? "1 comment saved" : `${saved} comments saved`);
    if (Object.keys(failed).length === 0) {
      setOpen(false);
      ai.clear();
      setChosen(new Set());
    }
  }

  const result = ai.result;
  // In the page's order, whatever order they came back in.
  const written = result ? students.filter((s) => texts[s.learnerId] !== undefined) : [];
  // Asked for but not drafted: no longer enrolled, or the AI skipped them.
  const without = result ? students.filter((s) => chosen.has(s.learnerId) && texts[s.learnerId] === undefined) : [];
  const tooLong = [...kept].some((l) => (texts[l] ?? "").trim().length > COMMENT_MAX);
  const empty = [...kept].some((l) => !(texts[l] ?? "").trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" /> Draft comments
      </Button>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result ? "Check each comment" : "Draft comments with AI"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Check the marks they mention against the report, and edit anything you'd say differently. The ones you tick are saved."
              : "Drafts come from each student's shared marks, attendance and missed work this term. Students' names aren't sent to the AI."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1">
          {ai.pending ? (
            <AiWorking feature="REPORT_COMMENTS" />
          ) : result ? (
            <>
              {without.length > 0 ? (
                <p className="text-muted-foreground text-sm">No draft for {without.map((s) => s.name).join(", ")}. Write {without.length === 1 ? "that one" : "those"} yourself.</p>
              ) : null}
              <ul className="space-y-3">
                {written.map((c) => {
                  const text = texts[c.learnerId] ?? "";
                  const over = text.trim().length - COMMENT_MAX;
                  return (
                    <li key={c.learnerId} className={cn("border-border space-y-2 rounded-lg border p-4", !kept.has(c.learnerId) && "opacity-70")}>
                      <label className="flex items-center gap-3 text-sm font-medium">
                        <Checkbox disabled={saving} checked={kept.has(c.learnerId)} onCheckedChange={(v) => flip(setKept, c.learnerId, v === true)} />
                        <span className="min-w-0 flex-1">{c.name}</span>
                        {c.mark ? <span className="text-muted-foreground text-xs font-normal tabular-nums">On the report: {c.mark}</span> : null}
                      </label>
                      <Textarea
                        aria-label={`Comment for ${c.name}`}
                        aria-invalid={over > 0 || undefined}
                        rows={4}
                        value={text}
                        disabled={saving}
                        onChange={(e) => setTexts((t) => ({ ...t, [c.learnerId]: e.target.value }))}
                      />
                      {over > 0 ? <p className="text-destructive text-xs">{over} {over === 1 ? "character" : "characters"} too long. Shorten it to {COMMENT_MAX}.</p> : null}
                      {errors[c.learnerId] ? <p role="alert" className="text-destructive text-xs">{errors[c.learnerId]}</p> : null}
                      {kept.has(c.learnerId) && hasComment(c.learnerId) ? <p className="text-warning text-xs">Replaces the comment already there.</p> : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              {ai.error ? <AiError>{ai.error}</AiError> : null}
              <div className="space-y-1.5 sm:max-w-56">
                <Label htmlFor={`${id}-tone`}>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as "warm" | "formal")}>
                  <SelectTrigger id={`${id}-tone`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-foreground mb-1 text-sm font-medium">
                  Students{students.length > max ? ` (up to ${max} at a time)` : ""}
                </legend>
                <ul className="divide-border border-border divide-y rounded-lg border">
                  {students.map((s) => {
                    const on = chosen.has(s.learnerId);
                    return (
                      <li key={s.learnerId} className="space-y-2 px-4 py-2.5">
                        <label className="flex items-center gap-3 text-sm">
                          <Checkbox checked={on} disabled={!on && chosen.size >= max} onCheckedChange={(v) => flip(setChosen, s.learnerId, v === true)} />
                          <span className="min-w-0 flex-1">{s.name}</span>
                          {hasComment(s.learnerId) ? <span className="text-muted-foreground text-xs">Has a comment</span> : null}
                        </label>
                        {on ? (
                          <Input
                            aria-label={`Note about ${s.name}`}
                            className="ml-7 w-[calc(100%-1.75rem)]"
                            value={notes[s.learnerId] ?? ""}
                            maxLength={300}
                            onChange={(e) => setNotes((n) => ({ ...n, [s.learnerId]: e.target.value }))}
                            placeholder="Anything to mention (optional)"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          {result ? (
            <>
              <Button type="button" variant="ghost" disabled={saving} onClick={ai.clear}>
                Start again
              </Button>
              <Button type="button" disabled={saving || kept.size === 0 || tooLong || empty} onClick={saveKept}>
                {saving ? "Saving…" : kept.size === 0 ? "Save comments" : `Save ${kept.size} ${kept.size === 1 ? "comment" : "comments"}`}
              </Button>
            </>
          ) : (
            <>
              <AiLeftLine feature="REPORT_COMMENTS" left={left} help={help} />
              <Button type="button" disabled={ai.pending || chosen.size === 0 || left?.left === 0} onClick={draft}>
                {chosen.size === 0 ? "Draft comments" : `Draft ${chosen.size} ${chosen.size === 1 ? "comment" : "comments"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
