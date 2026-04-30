/**
 * TestGrid — responsive grid wrapper for TestCard rows with empty-state slot.
 * Mirrors features/courses/components/course-grid.tsx.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TestGridProps {
  children: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

export function TestGrid({
  children,
  empty,
  isEmpty,
  className,
}: TestGridProps) {
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
