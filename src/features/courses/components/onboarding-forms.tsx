"use client";

/**
 * The setup steps' forms (a/ux/01, sections 3 and 4). Each calls one server
 * action and moves on; nothing is kept in the browser, so leaving and
 * coming back is safe.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace, updateWorkspaceProfile } from "@/features/workspaces/actions";
import { cn } from "@/lib/utils";

import { nextStep, previousStep, stepHref, timeZoneOptions, workspaceNameProblem, type OnboardingStep } from "../lib/onboarding-ui";
import { payoutErrorMessage } from "../lib/payouts-ui";

const SELECT =
  "border-input bg-background h-9 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

/** Back, Skip and Continue, in the layout the design draws. */
export function StepButtons({
  step,
  busy,
  continueLabel = "Continue",
  skippable,
}: {
  step: OnboardingStep;
  busy: boolean;
  continueLabel?: string;
  skippable: boolean;
}) {
  const back = previousStep(step);
  const next = nextStep(step);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      {back ? (
        <Button asChild variant="ghost">
          <Link href={stepHref(back)}>Back</Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="flex flex-wrap gap-2">
        {skippable ? (
          <Button asChild variant="outline">
            <Link href={next ? stepHref(next) : "/dashboard"}>Skip for now</Link>
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {continueLabel}
        </Button>
      </span>
    </div>
  );
}

/* ───── Solo or Organisation ───── */

const KINDS = [
  {
    kind: "SOLO" as const,
    icon: User,
    title: "Solo practice",
    lead: "I teach my own students.",
    body: "You own the workspace and teach in it.",
  },
  {
    kind: "ORGANISATION" as const,
    icon: Building2,
    title: "Organisation",
    lead: "We run a centre with several tutors.",
    body: "You manage tutors and teams. You don't have to teach.",
  },
];

export function KindChooser() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"SOLO" | "ORGANISATION" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(kind: "SOLO" | "ORGANISATION") {
    setBusy(kind);
    setError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await createWorkspace({ kind, ...(timezone ? { timezone } : {}) });
    if (!res?.data) {
      setBusy(null);
      return setError(res?.validationErrors ? "Something about that didn't work. Try again." : payoutErrorMessage(res?.serverError));
    }
    router.push(stepHref("business"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => void choose(k.kind)}
            disabled={busy != null}
            aria-busy={busy === k.kind}
            className={cn(
              "border-border hover:border-primary focus-visible:ring-ring flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors outline-none focus-visible:ring-2 disabled:opacity-60",
              busy === k.kind && "border-primary",
            )}
          >
            <span className="bg-muted text-foreground grid size-10 place-items-center rounded-lg">
              {busy === k.kind ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <k.icon aria-hidden className="size-5" />}
            </span>
            <span className="space-y-1">
              <span className="text-foreground block font-semibold">{k.title}</span>
              <span className="text-foreground block text-sm">{k.lead}</span>
              <span className="text-muted-foreground block text-sm">{k.body}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        You can&apos;t change this later, but you can create another workspace. Your 14-day trial starts now, with no card.
      </p>
      <ErrorText error={error} />
    </div>
  );
}

/* ───── Step 1: the name ───── */

export function BusinessForm({ name, timezone, organisation }: { name: string; timezone: string; organisation: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(name);
  const [zone, setZone] = React.useState(timezone);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const zones = React.useMemo(() => timeZoneOptions(timezone), [timezone]);
  const id = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = workspaceNameProblem(value);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const res = await updateWorkspaceProfile({ name: value.trim(), timezone: zone });
    if (!res?.data) {
      setBusy(false);
      return setError(res?.validationErrors ? "Check the name and try again." : payoutErrorMessage(res?.serverError));
    }
    router.push(stepHref("course"));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input id={`${id}-name`} value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} autoFocus aria-describedby={`${id}-name-help`} />
        <p id={`${id}-name-help`} className="text-muted-foreground text-xs">
          {organisation ? "For example Ubuntu Tutors." : "For example Thandi Maths Tutoring."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-zone`}>Time zone</Label>
        <select id={`${id}-zone`} value={zone} onChange={(e) => setZone(e.target.value)} className={SELECT}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">Due dates and reminders use this.</p>
      </div>
      <ErrorText error={error} />
      <StepButtons step="business" busy={busy} skippable={false} />
    </form>
  );
}
