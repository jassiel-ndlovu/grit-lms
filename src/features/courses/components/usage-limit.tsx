"use client";

/**
 * The owner's own limit on one meter (a/ux/03-billing.md §3, A's
 * setUsageCap). Caps are stored and shown against usage but not yet
 * enforced (A, #106), so the copy calls it a limit to watch, not a stop.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUsageCap } from "@/features/billing/actions";

import { parseLimit } from "../lib/admin-billing-ui";
import { billingErrorMessage, countLabel, type CapMeter } from "../lib/billing-ui";

export function UsageLimit({
  meter,
  unit,
  current,
}: {
  meter: CapMeter;
  unit: readonly [string, string];
  /** The owner's own limit now, or null when they haven't set one. */
  current: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(current != null ? String(current) : "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();

  async function save(limit: number | null) {
    setBusy(true);
    setError(null);
    // hardStop off: the copy promises no stop, so a later enforcement
    // must not start blocking a limit set under this wording.
    const res = await setUsageCap({ meter, limitQuantity: limit, hardStop: false });
    setBusy(false);
    if (res?.serverError || res?.validationErrors) {
      return setError(res.serverError ? billingErrorMessage(res.serverError) : "Enter a whole number of 1 or more.");
    }
    toast.success(limit == null ? "Limit removed." : `Limit set to ${countLabel(limit, unit)} a period.`);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {current != null ? <span>Your limit: {countLabel(current, unit)} a period.</span> : null}
        <button type="button" onClick={() => setEditing(true)} className="text-foreground underline underline-offset-2">
          {current != null ? "Change limit" : "Set a limit"}
        </button>
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseLimit(value);
        if (n == null) return setError("Enter a whole number of 1 or more.");
        void save(n);
      }}
      className="border-border space-y-3 rounded-lg border p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-limit`}>Limit a period ({unit[1]})</Label>
        <Input
          id={`${id}-limit`}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40"
          aria-describedby={`${id}-help`}
          autoFocus
        />
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          Shown against what you use, so you can see when you&apos;re close. Nexa doesn&apos;t stop anything at the limit yet.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Save limit
        </Button>
        {current != null ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void save(null)}>
            Remove limit
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(current != null ? String(current) : "");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
