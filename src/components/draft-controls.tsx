"use client";

/**
 * UI for useLocalDraft: a status chip + "Save progress" button for the
 * sticky save bars, and a restore banner shown when a draft is found.
 */

import * as React from "react";
import { History, Save } from "lucide-react";
import { toast } from "sonner";

import { useDateContext } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { TonePanel } from "@/components/ui/nexus";
import { SaveState } from "@/components/ui/save-state";
import { formatDateTime } from "@/lib/datetime";
import type { LocalDraft } from "@/lib/use-local-draft";

export function DraftStatus({
  draft,
  className,
}: {
  draft: Pick<LocalDraft<unknown>, "status" | "lastSavedAt">;
  className?: string;
}) {
  const kind = draft.status === "dirty" ? "saving" : draft.status === "error" ? "failed" : draft.lastSavedAt ? "saved" : "idle";
  return <SaveState kind={kind} at={draft.lastSavedAt} where="device" className={className} />;
}

export function SaveProgressButton({
  draft,
  size = "default",
}: {
  draft: Pick<LocalDraft<unknown>, "saveNow">;
  size?: "default" | "sm";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={() => {
        if (draft.saveNow()) toast.success("Progress saved on this device.");
        else toast.error("Couldn't save progress — browser storage is unavailable.");
      }}
    >
      <Save className="size-4" />
      Save progress
    </Button>
  );
}

export function RestoreDraftBanner<T>({
  draft,
  onRestore,
  what = "this form",
}: {
  draft: LocalDraft<T>;
  onRestore: (data: T) => void;
  what?: string;
}) {
  const ctx = useDateContext();
  if (!draft.pending) return null;
  const at = draft.pending.savedAt;
  return (
    <TonePanel tone="accent" className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-start gap-3">
        <History className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
        <div className="text-sm">
          <p className="text-foreground font-medium">Unsaved progress found</p>
          <p className="text-muted-foreground text-xs">
            You have work on {what} saved on this device from{" "}
            {formatDateTime(at, ctx)}{" "}
            that was never submitted.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={draft.discardPending}>
          Discard
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={() => {
            const data = draft.takePending();
            if (data != null) {
              onRestore(data);
              toast.success("Progress restored.");
            }
          }}
        >
          Restore
        </Button>
      </div>
    </TonePanel>
  );
}
