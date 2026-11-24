"use client";

/** A branch's rollout buttons: Start pilot, Go live, or step back (viewer.md "Bulk onboarding"). */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { setBranchRolloutAction } from "../brand-actions";

type Rollout = "PLANNED" | "PILOT" | "LIVE";

export function BranchRollout({ branchId, rollout, name }: { branchId: string; rollout: Rollout; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Rollout | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const next: Array<{ to: Rollout; label: string; primary?: boolean }> =
    rollout === "PLANNED" ? [{ to: "PILOT", label: "Start pilot", primary: true }]
      : rollout === "PILOT" ? [{ to: "LIVE", label: "Go live", primary: true }, { to: "PLANNED", label: "Back to planning" }]
        : [{ to: "PILOT", label: "Back to pilot" }];

  async function move(to: Rollout) {
    if (to === "LIVE" && !window.confirm(`Put ${name} live? Everyone in it uses Nexa from now on.`)) return;
    setBusy(to);
    setError(null);
    const r = await setBranchRolloutAction({ branchId, rollout: to }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(r?.serverError ?? "That didn't save. Try again.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {next.map((n) => (
          <Button key={n.to} size="sm" variant={n.primary ? "brand" : "ghost"} disabled={busy !== null} onClick={() => void move(n.to)}>
            {busy === n.to ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}{n.label}
          </Button>
        ))}
      </div>
      {error ? <p role="alert" className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
