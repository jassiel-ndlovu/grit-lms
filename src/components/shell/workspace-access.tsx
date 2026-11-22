"use client";

/**
 * Read-only workspaces (#189; viewer.md rule 4, Draft 1.10). While a
 * workspace is READ_ONLY or CANCELLED, A's action clients refuse staff
 * writes with `READ_ONLY:`. The screens say so before anyone tries: the
 * dashboard layout provides `readOnly` (staff in a read-only workspace),
 * and `WriteGuard` swaps a write control for a disabled one that tells why.
 *
 * The server stays the guard; this only keeps people from hitting it.
 */

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { READ_ONLY_REASON } from "@/features/courses/lib/teaching-ui";
import type { MeetingProvider } from "@/lib/viewer-core";

export { READ_ONLY_REASON };

const WorkspaceAccess = React.createContext<{ readOnly: boolean; meetingProvider: MeetingProvider }>({
  readOnly: false,
  meetingProvider: "GOOGLE_MEET",
});

export function WorkspaceAccessProvider({
  readOnly,
  meetingProvider = "GOOGLE_MEET",
  children,
}: {
  readOnly: boolean;
  /** The workspace's meeting provider (#211), for the event form. */
  meetingProvider?: MeetingProvider;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ readOnly, meetingProvider }), [readOnly, meetingProvider]);
  return <WorkspaceAccess.Provider value={value}>{children}</WorkspaceAccess.Provider>;
}

/** The workspace's meeting provider (#211); Google Meet outside a workspace. */
export function useMeetingProvider(): MeetingProvider {
  return React.useContext(WorkspaceAccess).meetingProvider;
}

/** True for staff while the active workspace is read-only. */
export function useReadOnly(): boolean {
  return React.useContext(WorkspaceAccess).readOnly;
}

/**
 * Renders `children` (a write control) normally; in a read-only workspace
 * renders a disabled button with the same label and a lock, described by
 * the reason. `as="link"` keeps a quiet text style for inline links.
 */
export function WriteGuard({
  label,
  children,
  size = "sm",
  variant = "outline",
  as = "button",
}: {
  label: string;
  children: React.ReactNode;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "brand";
  as?: "button" | "link";
}) {
  const readOnly = useReadOnly();
  const id = React.useId();
  if (!readOnly) return <>{children}</>;
  if (as === "link") {
    return (
      <span aria-disabled="true" aria-describedby={id} title={READ_ONLY_REASON} className="text-muted-foreground/70 inline-flex cursor-not-allowed items-center gap-1">
        <Lock aria-hidden className="size-3" />
        {label}
        <span id={id} className="sr-only">
          {READ_ONLY_REASON}
        </span>
      </span>
    );
  }
  return (
    <span title={READ_ONLY_REASON} className="inline-flex">
      <Button type="button" size={size} variant={variant} disabled aria-describedby={id}>
        <Lock aria-hidden className="size-4" />
        {label}
      </Button>
      <span id={id} className="sr-only">
        {READ_ONLY_REASON}
      </span>
    </span>
  );
}

/** A line for forms and empty states: why nothing can be added, with the way out. */
export function ReadOnlyNote({ billingHref }: { billingHref?: string | null }) {
  const readOnly = useReadOnly();
  if (!readOnly) return null;
  return (
    <p role="note" className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
      <Lock aria-hidden className="size-3.5" />
      {READ_ONLY_REASON}
      {billingHref ? (
        <Link href={billingHref} className="text-foreground underline underline-offset-2">
          Go to billing
        </Link>
      ) : null}
    </p>
  );
}
