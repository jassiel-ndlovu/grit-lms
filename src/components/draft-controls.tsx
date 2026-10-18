"use client";

/**
 * UI for useLocalDraft: a status chip + "Save progress" button for the
 * sticky save bars, and a restore banner shown when a draft is found.
 */

import * as React from "react";
import { CloudOff, HardDriveDownload, History, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocalDraft } from "@/lib/use-local-draft";

function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DraftStatus({
  draft,
  className,
}: {
  draft: Pick<LocalDraft<unknown>, "status" | "lastSavedAt">;
  className?: string;
}) {
  const online = useOnline();
  let text: string;
  if (draft.status === "dirty") text = "Saving progress…";
  else if (draft.status === "error") text = "Couldn't save progress on this device";
  else if (draft.lastSavedAt) text = `Progress saved ${timeOf(draft.lastSavedAt)}`;
  else text = "Progress auto-saves on this device";

  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5 text-xs",
        draft.status === "error" && "text-destructive",
        className,
      )}
      aria-live="polite"
    >
      {draft.status === "dirty" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <HardDriveDownload className="size-3" />
      )}
      {text}
      {!online && (
        <span className="text-brand-terracotta inline-flex items-center gap-1">
          <CloudOff className="size-3" /> Offline — kept locally
        </span>
      )}
    </span>
  );
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
  if (!draft.pending) return null;
  const at = draft.pending.savedAt;
  return (
    <div className="border-brand-terracotta/40 bg-brand-terracotta/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="flex items-start gap-3">
        <History className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
        <div className="text-sm">
          <p className="text-foreground font-medium">Unsaved progress found</p>
          <p className="text-muted-foreground text-xs">
            You have work on {what} saved on this device from{" "}
            {at.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}{" "}
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
    </div>
  );
}
