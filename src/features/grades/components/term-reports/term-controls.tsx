"use client";

/**
 * The owner's and admins' controls for report terms: new, edit, release to
 * families (and take back), delete.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { reportRoutes, TERM_TITLE_MAX, termDaysError } from "../../lib/term-report";
import { deleteReportTerm, releaseReportTerm, saveReportTerm } from "../../term-report-actions";

const FAILED = "That didn't work. Try again.";

export interface EditableTerm {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
}

/** "New term", or "Edit term" when there is one. */
export function TermDialogButton({ term }: { term?: EditableTerm }) {
  const router = useRouter();
  const fieldId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [startsOn, setStartsOn] = React.useState("");
  const [endsOn, setEndsOn] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function show() {
    setTitle(term?.title ?? "");
    setStartsOn(term?.startsOn ?? "");
    setEndsOn(term?.endsOn ?? "");
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const wrong = termDaysError(startsOn, endsOn);
    setError(wrong);
    if (wrong) return;
    setPending(true);
    const r = await saveReportTerm({ id: term?.id, title, startsOn, endsOn }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      setError(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    if (term) {
      toast.success("Term saved");
      router.refresh();
    } else router.push(reportRoutes.term(r.data.id));
  }

  const label = term ? "Edit term" : "New term";
  return (
    <WriteGuard label={label} variant={term ? "outline" : "default"}>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant={term ? "outline" : "default"} onClick={show}>
          {term ? <Pencil aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
          {label}
        </Button>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>Reports cover assessments due between these days, and classes held in them.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-title`}>Name</Label>
              <Input id={`${fieldId}-title`} value={title} maxLength={TERM_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Term 4 2026" autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-from`}>First day</Label>
                <Input id={`${fieldId}-from`} type="date" value={startsOn} max={endsOn || undefined} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-to`}>Last day</Label>
                <Input id={`${fieldId}-to`} type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
            </div>
            {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim() || !startsOn || !endsOn}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}

/** "Release to families" and "Take back", each confirmed. */
export function ReleaseTermButton({ termId, released, missing }: { termId: string; released: boolean; missing: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    const r = await releaseReportTerm({ id: termId, released: !released }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    toast.success(r.data.released ? "Reports shared" : "Reports taken back");
    router.refresh();
  }

  const label = released ? "Take back" : "Share with families";
  const Icon = released ? Undo2 : Send;
  return (
    <WriteGuard label={label} variant={released ? "outline" : "default"}>
      <Button size="sm" variant={released ? "outline" : "default"} onClick={() => setOpen(true)}>
        <Icon aria-hidden className="size-4" />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{released ? "Take these reports back?" : "Share these reports?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {released
                ? "Families won't be able to download them until you share them again. Copies they already downloaded stay with them."
                : `Parents and adult students will be able to download them. Later changes to marks and comments show in new downloads.${
                    missing > 0 ? ` ${missing} ${missing === 1 ? "comment isn't" : "comments aren't"} written yet.` : ""
                  }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={pending}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Icon aria-hidden className="size-4" />}
              {released ? "Take back" : "Share"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}

export function DeleteTermButton({ termId, title }: { termId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    const r = await deleteReportTerm({ id: termId }).catch(() => null);
    if (!r?.data) {
      setPending(false);
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    toast.success("Term deleted");
    router.replace(reportRoutes.home);
  }

  return (
    <WriteGuard label="Delete term">
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-4" />
        Delete term
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>Every comment written for it goes too. Marks and attendance stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={pending}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}
