"use client";

/**
 * CourseActions — dropdown menu on a tutor's CourseCard with Edit and Delete
 * options. The Delete branch wraps a confirmation AlertDialog so accidental
 * clicks don't nuke a course.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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

import { deleteCourse } from "../actions";

export interface CourseActionsProps {
  courseId: string;
  courseName: string;
  /** False for a role that edits courses but doesn't create them; the server checks too. */
  canDelete?: boolean;
}

export function CourseActions({ courseId, courseName, canDelete = true }: CourseActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirmDelete() {
    setPending(true);
    try {
      const res = await deleteCourse({ id: courseId });
      if (res?.serverError) {
        throw new Error(res.serverError);
      }
      toast.success(`Deleted "${courseName}"`);
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't delete the course. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Not modal: a modal menu and the dialog it opens each lock the page, and unlocking in the wrong order leaves it unclickable. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">Open course actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/manage-courses/${courseId}/settings`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{courseName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Its lessons, tests, assignments, students&apos; work and marks are all deleted. This can&apos;t be undone.
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
              {pending ? "Deleting…" : "Delete course"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
