"use client";

/**
 * BeginTestButton — client island that calls the startTestSubmission Server
 * Action and routes the student into the runner. Idempotent: if an
 * IN_PROGRESS submission already exists the action returns its id so the
 * student just resumes.
 *
 * The runner page itself is currently the legacy /dashboard/tests/[id]
 * route — until that's rebuilt this button just refreshes so the runner
 * picks up the freshly-created session.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { startTestSubmission } from "../actions";

export interface BeginTestButtonProps {
  testId: string;
  /** Where to send the student after the action succeeds. */
  redirectTo: string;
  /** Override the trigger label. */
  label?: string;
  className?: string;
}

export function BeginTestButton({
  testId,
  redirectTo,
  label = "Begin test",
  className,
}: BeginTestButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const result = await startTestSubmission({ testId });
        if (result?.serverError) throw new Error(result.serverError);
        router.push(redirectTo);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start test");
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Play className="size-4" />
      )}
      {label}
    </Button>
  );
}
