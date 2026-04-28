"use client";

/**
 * LessonActions — small dropdown rendered next to a lesson row in the
 * tutor sidebar. Offers a destructive "Delete" with an AlertDialog
 * confirmation. Edit isn't a separate action — clicking the lesson row
 * itself selects it for editing in the main pane.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2 } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteLesson } from "../actions";

export interface LessonActionsProps {
  lessonId: string;
  lessonTitle: string;
  /** When the deleted lesson is currently selected, navigate here afterward. */
  isSelected?: boolean;
  /** Course id used to navigate back to the lesson list after delete. */
  courseId: string;
}

export function LessonActions({
  lessonId,
  lessonTitle,
  isSelected,
  courseId,
}: LessonActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirmDelete() {
    setPending(true);
    try {
      const res = await deleteLesson({ id: lessonId });
      if (res?.serverError) throw new Error(res.serverError);
      toast.success(`Deleted "${lessonTitle}"`);
      setConfirmOpen(false);
      if (isSelected) {
        router.push(`/dashboard/manage-courses/lessons/${courseId}`);
      } else {
        router.refresh();
      }
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
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => e.preventDefault()}
            aria-label={`Actions for ${lessonTitle}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
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
            <AlertDialogTitle>Delete &quot;{lessonTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the lesson, its attachments, and any
              completion records. This action cannot be undone.
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
              {pending ? "Deleting…" : "Delete lesson"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
