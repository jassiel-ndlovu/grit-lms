"use client";

/**
 * "Finish setting up" on the home page (a/ux/01, section 4) for whoever
 * runs a workspace in its trial. What's done comes from the server; the ×
 * hides it in this browser (A's dismissOnboarding isn't built yet). It goes
 * away by itself once everything is done.
 */

import * as React from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TonePanel } from "@/components/ui/nexus";
import { ProgressBar } from "@/components/ui/progress-bar";

import { stepHref, type OnboardingStep } from "../lib/onboarding-ui";

type Item = { key: OnboardingStep; label: string; done: boolean };

const ACTION: Record<OnboardingStep, string> = { business: "Name", course: "Create", students: "Add", payouts: "Connect" };

export function SetupChecklist({ workspaceId, items }: { workspaceId: string; items: Item[] }) {
  const key = `nexa.setup.dismissed.${workspaceId}`;
  // Hidden until read, so it never flashes for someone who closed it.
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Private mode: it just comes back next visit.
    }
    setHidden(true);
  }

  return (
    <TonePanel as="section" tone="accent" aria-labelledby="setup-heading" className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-heading" className="text-foreground text-sm font-semibold">
            Finish setting up
          </h2>
          <p className="text-muted-foreground text-xs">
            {done} of {items.length} done
          </p>
          <ProgressBar label="Setup" value={done} max={items.length} valueText={`${done} of ${items.length} done`} className="mt-2 w-40" />
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={dismiss} aria-label="Hide the setup list">
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <ul className="divide-border divide-y text-sm">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between gap-3 py-2">
            <span className="flex items-center gap-2">
              {i.done ? (
                <span className="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full">
                  <Check aria-hidden className="size-3" />
                </span>
              ) : (
                <span aria-hidden className="border-border size-5 rounded-full border" />
              )}
              <span className={i.done ? "text-muted-foreground" : "text-foreground"}>
                {i.label}
                <span className="sr-only">{i.done ? " (done)" : " (to do)"}</span>
              </span>
            </span>
            {i.done ? null : (
              <Button asChild variant="outline" size="sm">
                <Link href={stepHref(i.key)}>{ACTION[i.key]}</Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </TonePanel>
  );
}
