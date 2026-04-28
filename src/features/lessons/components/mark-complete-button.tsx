"use client";

/**
 * MarkCompleteButton — student-only toggle that flips a lesson between
 * "completed" and "not completed".
 *
 * Calls `markLessonComplete` / `unmarkLessonComplete` Server Actions.
 * Optimistic UI: the button immediately reflects the desired state; if the
 * action fails the local state rolls back and a toast surfaces the error.
 */

import * as React from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { markLessonComplete, unmarkLessonComplete } from "../actions";

export interface MarkCompleteButtonProps {
  lessonId: string;
  initialCompleted: boolean;
  className?: string;
}

export function MarkCompleteButton({
  lessonId,
  initialCompleted,
  className,
}: MarkCompleteButtonProps) {
  const router = useRouter();
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !completed;
    setCompleted(next); // optimistic

    startTransition(async () => {
      try {
        const result = next
          ? await markLessonComplete({ lessonId })
          : await unmarkLessonComplete({ lessonId });

        if (result?.serverError) {
          throw new Error(result.serverError);
        }
        toast.success(next ? "Lesson marked complete" : "Marked incomplete");
        router.refresh();
      } catch (e) {
        setCompleted(!next); // rollback
        toast.error(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={completed ? "outline" : "default"}
      onClick={toggle}
      disabled={pending}
      className={cn(className)}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : completed ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <Circle className="size-4" />
      )}
      {completed ? "Completed" : "Mark complete"}
    </Button>
  );
}
