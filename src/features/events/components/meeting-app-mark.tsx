/**
 * A small mark for a meeting app, so the choice reads faster: the app's
 * initial on a neutral tile, or a link icon for "Something else".
 *
 * These are not the brands' logos. Zoom's and Microsoft's guidelines don't
 * allow theirs without a written licence, and Google's only cover approved
 * uses (checked 2026-11-23, docs/revamp/b/HANDOFF.md). If the owner gets
 * permission, put the official files here and nothing else changes.
 */

import { Link2 } from "lucide-react";

import type { MeetingProvider } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

const INITIAL: Record<MeetingProvider, string | null> = {
  GOOGLE_MEET: "M",
  ZOOM: "Z",
  TEAMS: "T",
  OTHER: null,
};

export function MeetingAppMark({ provider, className }: { provider: MeetingProvider; className?: string }) {
  const initial = INITIAL[provider];
  return (
    <span
      aria-hidden
      className={cn(
        "bg-muted text-foreground border-border grid size-6 shrink-0 place-items-center rounded-md border text-xs font-semibold",
        className,
      )}
    >
      {initial ?? <Link2 className="size-3.5" />}
    </span>
  );
}
