/**
 * CourseGrid — responsive grid wrapper around a list of CourseCards, with
 * an empty-state slot for "no courses yet" messaging.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface CourseGridProps {
  children: React.ReactNode;
  /** Rendered when `children` is empty. */
  empty?: React.ReactNode;
  /** Should be true when no children are passed — toggles the empty slot. */
  isEmpty?: boolean;
  className?: string;
}

export function CourseGrid({
  children,
  empty,
  isEmpty,
  className,
}: CourseGridProps) {
  if (isEmpty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
