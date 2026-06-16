"use client";

/**
 * TutorTestActions — three-dot dropdown on tutor test cards. Surfaces:
 *   - View submissions  → /dashboard/tutor-tests/[id]/submissions
 *   - Edit test         → /dashboard/manage-courses/[courseId] (until the
 *                          dedicated tutor authoring UI lands)
 *   - Delete            → confirmation AlertDialog → deleteTest action
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

import { deleteTest } from "../actions";

export interface TutorTestActionsProps {
  testId: string;
  testTitle: string;
  courseId: string;
}

export function TutorTestActions({
  testId,
  testTitle,
  courseId,
}: TutorTestActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirmDelete() {
    setPending(true);
    try {
      const res = await deleteTest({ id: testId });
      if (res?.serverError) throw new Error(res.serverError);
      toast.success(`Deleted "${testTitle}"`);
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
            aria-label={`Actions for ${testTitle}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/tutor-tests/${testId}/submissions`}>
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
            <AlertDialogTitle>Delete &quot;{testTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the test, its questions, and every
              student submission. Already-released grades disappear too.
              This action cannot be undone.
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
              {pending ? "Deleting…" : "Delete test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
