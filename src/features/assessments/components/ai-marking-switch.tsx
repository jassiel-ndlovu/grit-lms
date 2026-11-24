"use client";

/**
 * The per-test switch for AI-suggested marks (#150), in the test
 * designer's settings. Turning it on asks the tutor to confirm they hold
 * parents' consent (`setTestAiMarking({ consentConfirmed })`). Without the
 * course's `ai-marking` service (Pro) the switch gives way to the upgrade
 * path the billing screens use: the course's Services page.
 *
 * Saves at once, apart from the form's Save: it changes nothing a student
 * sees, and the AI only ever suggests.
 */

import * as React from "react";
import Link from "next/link";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { READ_ONLY_REASON, useReadOnly } from "@/components/shell/workspace-access";
import { setTestAiMarking } from "@/features/ai-marking/actions";

import { aiSwitchState } from "../lib/ai-marking-ui";

type SetAiMarking = (input: { testId: string; on: boolean; consentConfirmed?: boolean }) => Promise<{ data?: { aiMarking: boolean }; serverError?: string } | undefined>;

export function AiMarkingSwitch({
  testId,
  initialOn,
  available,
  servicesHref,
  action = setTestAiMarking as SetAiMarking,
}: {
  testId: string;
  initialOn: boolean;
  /** hasService(viewer, courseId, "ai-marking"). */
  available: boolean;
  /** The course's Services page, when billing is on. */
  servicesHref: string | null;
  /** For the preview pages only; the real action by default. */
  action?: SetAiMarking;
}) {
  const readOnly = useReadOnly();
  const [on, setOn] = React.useState(initialOn);
  const [asking, setAsking] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const state = aiSwitchState({ on, available, readOnly });
  const descId = React.useId();

  async function save(next: boolean) {
    setPending(true);
    setError(null);
    try {
      const r = await action({ testId, on: next, consentConfirmed: next ? true : undefined });
      if (r?.serverError) throw new Error(r.serverError);
      setOn(next);
      setAsking(false);
      setConsent(false);
      toast.success(next ? "AI-suggested marks are on for this test" : "AI-suggested marks are off for this test");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't change this setting. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border space-y-2 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <p className="text-foreground font-medium" id={`${descId}-label`}>
            AI-suggested marks
          </p>
          <p id={descId} className="text-muted-foreground text-xs">
            The AI suggests a mark for short answers and essays. You accept, edit or reject every one, and students see nothing until you save the mark. Answers are sent, without names, to an AI service outside South Africa.
          </p>
        </div>
        {state === "upgrade" ? null : (
          <Switch
            aria-labelledby={`${descId}-label`}
            aria-describedby={descId}
            checked={on}
            disabled={pending || state === "locked"}
            onCheckedChange={(next) => (next ? setAsking(true) : void save(false))}
          />
        )}
      </div>

      {state === "upgrade" ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 pl-7 text-xs">
          <Lock aria-hidden className="size-3" />
          Part of the Pro plan for this course.
          {servicesHref ? (
            <Link href={servicesHref} className="text-foreground underline underline-offset-2">
              See plans and services
            </Link>
          ) : null}
        </p>
      ) : null}
      {state === "locked" ? (
        <p className="text-muted-foreground flex items-center gap-1.5 pl-7 text-xs">
          <Lock aria-hidden className="size-3" />
          {READ_ONLY_REASON}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive pl-7 text-xs">
          {error}
        </p>
      ) : null}

      <Dialog open={asking} onOpenChange={(o) => !pending && (setAsking(o), setConsent(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn on AI-suggested marks?</DialogTitle>
            <DialogDescription>
              Students&apos; written answers will be sent, without names, to an AI service outside South Africa, which suggests a mark. You need parents&apos; consent for this class first.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
            <span>I confirm I hold parents&apos; consent for AI-assisted marking of this class&apos;s work.</span>
          </label>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAsking(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="brand" onClick={() => save(true)} disabled={!consent || pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Turn on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
