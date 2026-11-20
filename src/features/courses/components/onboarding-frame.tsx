/**
 * The setup screens' frame (a/ux/01, section 4): logo and trial chip, the
 * step list, then the step. No sidebar (nav-config isFocusRoute).
 */

import Link from "next/link";
import { Check } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { cn } from "@/lib/utils";

import { ONBOARDING_STEPS, stepHref, type OnboardingStep } from "../lib/onboarding-ui";

export function OnboardingFrame({
  step,
  trialDays,
  children,
}: {
  /** The current step, or null on "Solo or Organisation". */
  step: OnboardingStep | null;
  trialDays: number | null;
  children: React.ReactNode;
}) {
  const at = step ? ONBOARDING_STEPS.findIndex((s) => s.key === step) : -1;
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="font-display text-foreground text-lg tracking-tight">
          Nexa
        </Link>
        {trialDays != null ? (
          <StatusChip tone={trialDays <= 3 ? "warning" : "info"}>
            Trial · {trialDays === 1 ? "1 day" : `${trialDays} days`} left
          </StatusChip>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {step ? (
          <nav aria-label="Setup steps">
            <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = i < at;
                const current = i === at;
                return (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 place-items-center rounded-full border text-[0.6875rem] font-semibold",
                        done && "bg-primary border-primary text-primary-foreground",
                        current && "border-primary text-primary",
                        !done && !current && "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    {done ? (
                      <Link href={stepHref(s.key)} className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                        {s.label}
                        <span className="sr-only"> (done)</span>
                      </Link>
                    ) : (
                      <span aria-current={current ? "step" : undefined} className={current ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {s.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export function StepHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground text-sm">{lead}</p>
    </div>
  );
}
