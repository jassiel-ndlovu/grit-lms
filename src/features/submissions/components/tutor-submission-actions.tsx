"use client";

/**
 * TutorSubmissionActions — three-dot dropdown on tutor assignment cards.
 *   - View submissions  → /dashboard/submissions/[id]
 *   - Edit              → /dashboard/manage-courses/[courseId] (until the
 *                          dedicated assignment editor lands)
 *   - Delete            → confirmation → deleteSubmission action
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteSubmission } from "../actions";

export interface TutorSubmissionActionsProps {
  submissionId: string;
  submissionTitle: string;
  courseId: string;
}

export function TutorSubmissionActions({
  submissionId,
  submissionTitle,
  courseId,
}: TutorSubmissionActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirmDelete() {
    setPending(true);
    try {
      const res = await deleteSubmission({ id: submissionId });
      if (res?.serverError) throw new Error(res.serverError);
      toast.success(`Deleted "${submissionTitle}"`);
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shadow-sm"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for ${submissionTitle}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/submissions/${submissionId}`}>
              <Eye className="size-4" /> View submissions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/manage-courses/${courseId}`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{submissionTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the assignment and every student entry
              against it. Already-released grades disappear too. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDelete();
              }}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
