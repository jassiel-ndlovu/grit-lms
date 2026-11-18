"use client";

/**
 * DeleteEntryButton — the tutor deletes one learner's hand-in, from the
 * per-student grading page. Confirms first; on success returns to the
 * assignment's list of hand-ins.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { deleteEntry } from "../actions";
import { assignmentRoutes } from "../routes";

export function DeleteEntryButton({
  entryId,
  submissionId,
  studentName,
}: {
  entryId: string;
  submissionId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirm() {
    setPending(true);
    try {
      const res = await deleteEntry({ id: entryId });
      if (!res?.data) throw new Error(res?.serverError ?? "Delete failed");
      toast.success(`Deleted ${studentName}'s hand-in`);
      setOpen(false);
      router.push(assignmentRoutes.detail(submissionId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" /> Delete hand-in
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {studentName}&apos;s hand-in?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes this hand-in, its grade and its section
            marks. {studentName} can hand in again while the assignment is
            open. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={pending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {pending ? "Deleting…" : "Delete hand-in"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
