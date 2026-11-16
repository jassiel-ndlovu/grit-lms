import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The one status a page header shows beside its title: Draft, Published,
 * Open, Closed, Graded… A dot plus a word, never colour alone.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function StatusChip({
  tone = "neutral", className, children, ...props
}: React.ComponentProps<"span"> & { tone?: StatusTone }) {
  return (
    <span
      data-slot="status-chip"
      className={cn(
        "border-border text-foreground inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}
