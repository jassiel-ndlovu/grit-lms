"use client";

/**
 * AutoGradeButton — runs the pure auto-grader against a student's
 * submission on demand. Useful when the test wasn't published with
 * release-to-student on, but the tutor still wants the objective
 * questions pre-marked before doing subjective grading.
 *
 * Refreshes the route on success so the GradingForm reloads with the
 * newly-populated QuestionGrades pre-filling the score inputs.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { autoGradeSubmissionAction } from "../actions";

export interface AutoGradeButtonProps {
  submissionId: string;
}

export function AutoGradeButton({ submissionId }: AutoGradeButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      const result = await autoGradeSubmissionAction({ submissionId });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data) throw new Error("Auto-grade returned no payload");
      toast.success(
        `Auto-graded ${data.autoCount} question${data.autoCount === 1 ? "" : "s"} (${data.autoScore}/${data.autoOutOf}). ${data.pendingCount} still need manual review.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-grade failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wand2 className="size-4" />
      )}
      Run auto-grade
    </Button>
  );
}
