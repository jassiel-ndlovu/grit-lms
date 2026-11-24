"use client";

import * as React from "react";
import { Check, CloudOff, HardDriveDownload, TriangleAlert } from "lucide-react";

import { useOnline } from "@/components/offline/use-online";
import { NexusLoader } from "@/components/ui/nexus";
import { saveText, type SaveKind, type SaveWhere } from "@/lib/save-state";
import { cn } from "@/lib/utils";

/**
 * The one saving indicator: "Saving…", "Saved 14:32", "Not saved", "Offline".
 * Every page that saves by itself uses it, so it always looks and reads the
 * same. `where="device"` is work kept in this browser, not yet in Nexa.
 */
export function SaveState({ kind, at, where = "nexa", error, quiet = false, compact = false, announce = true, className }: {
  kind: SaveKind;
  /** When it last saved. */
  at?: Date | null;
  where?: SaveWhere;
  /** Said instead of "Not saved". */
  error?: string | null;
  /** Show nothing before the first change. */
  quiet?: boolean;
  /** Only the symbol on phones (the words are still read out). */
  compact?: boolean;
  /** Read changes out. Off in the test runner, which says a failure in full elsewhere. */
  announce?: boolean;
  className?: string;
}) {
  const online = useOnline();
  const offline = !online && kind !== "failed";
  const text = saveText(kind, {
    where, offline, error,
    time: at ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
  });
  const hide = quiet && kind === "idle" && !offline;
  return (
    <span
      role={announce ? "status" : undefined}
      data-slot="save-state"
      title={compact && !hide ? text : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        kind === "failed" ? "text-destructive" : offline ? "text-warning" : "text-muted-foreground",
        className,
      )}
    >
      {hide ? null : (
        <>
          {offline ? (
            <CloudOff aria-hidden className="size-3.5 shrink-0" />
          ) : kind === "saving" ? (
            <NexusLoader size={14} label={null} className="text-current" />
          ) : kind === "failed" ? (
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          ) : kind === "saved" ? (
            <Check aria-hidden className="text-success size-3.5 shrink-0" />
          ) : kind === "pending" ? (
            <span aria-hidden className="bg-warning mx-1 size-1.5 shrink-0 rounded-full" />
          ) : where === "device" ? (
            <HardDriveDownload aria-hidden className="size-3.5 shrink-0" />
          ) : null}
          <span className={cn("tabular-nums", compact && kind !== "failed" && "max-sm:sr-only")}>{text}</span>
        </>
      )}
    </span>
  );
}
