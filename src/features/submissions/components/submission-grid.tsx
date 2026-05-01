import * as React from "react";

import { cn } from "@/lib/utils";

export interface SubmissionGridProps {
  children: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

/** Responsive grid wrapper for SubmissionCard rows with empty-state slot. */
export function SubmissionGrid({
  children,
  empty,
  isEmpty,
  className,
}: SubmissionGridProps) {
  if (isEmpty) {
    return <div className={className}>{empty}</div>;
  }
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
