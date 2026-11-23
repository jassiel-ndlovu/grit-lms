"use client";

/**
 * The tutor's practice sets (contracts/practice.md): "New set", and one
 * set's details, publish switch, questions and delete.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard, useReadOnly } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Topic } from "@/features/courses/lib/curriculum";

import type { BankListItem } from "../bank-actions";
import { canPractise } from "../lib/practice";
import {
  addPracticeItems, createPracticeSet, deletePracticeSet, removePracticeItem, updatePracticeSet,
} from "../practice-actions";
import { QuestionBankDialog } from "./question-bank-dialog";
import { TYPE_LABELS, type EditorQuestionType } from "./test-question-editor";

const FAILED = "That didn't work. Try again.";

export function NewPracticeSetButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const r = await createPracticeSet({ courseId, title }).catch(() => null);
    if (!r?.data) {
      setPending(false);
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    router.push(`/dashboard/manage-courses/${courseId}/practice/${r.data.id}`);
  }

  return (
    <WriteGuard label="New practice set" size="sm" variant="default">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden className="size-4" />
          New practice set
        </Button>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={create} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New practice set</DialogTitle>
              <DialogDescription>Name it, then add questions from your bank.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="practice-title">Name</Label>
              <Input
                id="practice-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Exponents and surds"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

export function PracticeSetDetails({
  set,
  questions,
}: {
  set: { id: string; title: string; description: string | null; isPublished: boolean };
  questions: number;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(set.title);
  const [description, setDescription] = React.useState(set.description ?? "");
  const [pending, setPending] = React.useState(false);
  const dirty = title.trim() !== set.title || description.trim() !== (set.description ?? "");

  async function save(patch: { title?: string; description?: string | null; isPublished?: boolean }, done: string) {
    setPending(true);
    const r = await updatePracticeSet({ id: set.id, ...patch }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    toast.success(done);
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="set-title">Name</Label>
        <Input id="set-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="set-description">Description (optional)</Label>
        <Textarea
          id="set-description"
          rows={2}
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={set.isPublished}
            disabled={pending || (!set.isPublished && questions === 0)}
            onCheckedChange={(on) => save({ isPublished: on }, on ? "Published. Students can practise it now." : "Hidden from students.")}
          />
          {set.isPublished ? "Published: students can practise it" : questions === 0 ? "Add a question to publish" : "Publish to students"}
        </label>
        <WriteGuard label="Save" size="sm" variant="default">
          <Button
            size="sm"
            disabled={pending || !dirty || !title.trim()}
            onClick={() => save({ title: title.trim(), description: description.trim() || null }, "Saved.")}
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
            Save
          </Button>
        </WriteGuard>
      </div>
    </div>
  );
}

export function PracticeItems({
  setId,
  courseId,
  topics,
  items,
}: {
  setId: string;
  courseId: string;
  topics: Topic[];
  items: Array<{ id: string; stem: string; type: string; topics: string[]; bankQuestionId: string | null }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const readOnly = useReadOnly();
  const inSet = new Set(items.map((i) => i.bankQuestionId).filter(Boolean));

  async function add(picked: BankListItem[]) {
    if (!picked.length) return;
    const r = await addPracticeItems({ setId, bankIds: picked.map((p) => p.id) }).catch(() => null);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    const { added, skipped } = r.data;
    if (added) toast.success(`Added ${added} ${added === 1 ? "question" : "questions"}${skipped ? `, skipped ${skipped}` : ""}.`);
    else toast.warning("Nothing was added: those questions are already here or can't be practised.");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    const r = await removePracticeItem({ id }).catch(() => null);
    setBusy(null);
    if (!r?.data) toast.error(r?.serverError ?? FAILED);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <WriteGuard label="Add from bank" size="sm" variant="outline">
        <QuestionBankDialog
          courseId={courseId}
          topics={topics}
          onAdd={add}
          description="Chosen questions are copied into this practice set. Only questions marked automatically, with an answer saved, can be practised."
          blocked={(item) =>
            inSet.has(item.id) ? "already in this set" : item.data && !canPractise(item.data) ? "can't be marked automatically" : null
          }
        />
      </WriteGuard>
      {items.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
          No questions yet. Add some from your bank.
        </p>
      ) : (
        <ol className="divide-border border-border divide-y border-y">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-start gap-3 px-2 py-2.5">
              <span className="text-muted-foreground w-6 shrink-0 text-sm tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="text-foreground block text-sm [overflow-wrap:anywhere]">{item.stem}</span>
                <span className="text-muted-foreground block text-xs">{[TYPE_LABELS[item.type as EditorQuestionType] ?? item.type, ...item.topics].join(" · ")}</span>
              </span>
              {readOnly ? null : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                  disabled={busy === item.id}
                  onClick={() => remove(item.id)}
                  aria-label={`Remove from this set: ${item.stem}`}
                >
                  {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function DeletePracticeSetButton({ set, courseId }: { set: { id: string; title: string }; courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    const r = await deletePracticeSet({ id: set.id }).catch(() => null);
    if (!r?.data) {
      setPending(false);
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    router.push(`/dashboard/manage-courses/${courseId}/practice`);
  }

  return (
    <WriteGuard label="Delete" size="sm" variant="outline">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-4" />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{set.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the set and students&apos; progress on it. Your bank keeps its questions. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}
