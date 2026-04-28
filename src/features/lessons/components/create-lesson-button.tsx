"use client";

/**
 * CreateLessonButton — "+ Add lesson" trigger that opens a Dialog containing
 * the LessonForm in create mode. Lives in the manage-lessons sidebar so
 * tutors can create without navigating away.
 *
 * After successful creation the dialog closes and the page navigates to
 * the new lesson via `?lesson={id}` — the RSC layer re-fetches and the
 * editor pane swaps into edit mode automatically.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { LessonForm } from "./lesson-form";

export interface CreateLessonButtonProps {
  courseId: string;
  /** Order to assign to the new lesson — typically `lessons.length`. */
  nextOrder?: number;
  /** Optional override for the trigger label. */
  label?: string;
}

export function CreateLessonButton({
  courseId,
  nextOrder = 0,
  label = "Add lesson",
}: CreateLessonButtonProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-center">
          <Plus className="size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a new lesson</DialogTitle>
          <DialogDescription>
            Add a title, description, and optionally videos and attachments.
          </DialogDescription>
        </DialogHeader>
        <LessonForm
          className="max-h-[70vh] overflow-y-auto"
          courseId={courseId}
          defaultValues={{ order: nextOrder }}
          onSuccess={({ id }) => {
            setOpen(false);
            router.push(
              `/dashboard/manage-courses/lessons/${courseId}?lesson=${id}`,
            );
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
