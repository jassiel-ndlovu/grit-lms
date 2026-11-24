"use client";

/**
 * SubmissionAdminPanel — small client card the tutor sees on the grading
 * page for one student's TestSubmission. Exposes:
 *   - Manual status override (Select)  → updateTestSubmissionStatus
 *   - Delete submission (with confirm) → deleteTestSubmission
 *
 * Kept as a separate component so the grading form stays focused on
 * scoring; this is admin plumbing.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  deleteTestSubmission,
  updateTestSubmissionStatus,
} from "../actions";

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "SUBMITTED", label: "Handed in (to mark)" },
  { value: "GRADED", label: "Marked" },
  { value: "LATE", label: "Handed in late" },
  { value: "NOT_SUBMITTED", label: "Not handed in" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

export interface SubmissionAdminPanelProps {
  submissionId: string;
  testId: string;
  studentName: string;
  initialStatus: Status;
}

export function SubmissionAdminPanel({
  submissionId,
  testId,
  studentName,
  initialStatus,
}: SubmissionAdminPanelProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function saveStatus(next: Status) {
    if (next === status) return;
    setSavingStatus(true);
    try {
      const result = await updateTestSubmissionStatus({ id: submissionId, status: next });
      if (result?.serverError) throw new Error(result.serverError);
      setStatus(next);
      toast.success("Status changed.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't change the status. Try again.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      const result = await deleteTestSubmission({ id: submissionId });
      if (result?.serverError) throw new Error(result.serverError);
      toast.success(`Deleted ${studentName}'s submission`);
      router.push(`/dashboard/tutor-tests/${testId}/submissions`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't delete this attempt. Try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <section aria-labelledby="submission-admin" className="border-border space-y-3 border-t pt-6">
        <div>
          <h2 id="submission-admin" className="text-foreground text-sm font-semibold">
            Submission
          </h2>
          <p className="text-muted-foreground text-xs">
            Change this attempt&apos;s status by hand, or delete it. Deleting it deletes its mark too.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="submission-status" className="text-muted-foreground text-xs">Status</label>
            <Select
              value={status}
              onValueChange={(v) => saveStatus(v as Status)}
              disabled={savingStatus || deleting}
            >
              <SelectTrigger id="submission-status" className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingStatus && (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 border-destructive/30 ml-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || savingStatus}
          >
            <Trash2 className="size-3.5" />
            Delete submission
          </Button>
        </div>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {studentName}&apos;s submission?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their answers, the mark for each question and their total are deleted. They can take the test again if it&apos;s still open. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete submission"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
