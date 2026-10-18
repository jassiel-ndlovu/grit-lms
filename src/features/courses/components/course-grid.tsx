/**
 * CourseGrid — responsive grid wrapper around a list of CourseCards, with
 * an empty-state slot for "no courses yet" messaging. `view="LIST"` (the
 * user's "Course layout" setting) stacks the cards as rows; CourseCard
 * switches to its horizontal layout via the `data-view` attribute.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface CourseGridProps {
  children: React.ReactNode;
  /** Rendered when `children` is empty. */
  empty?: React.ReactNode;
  /** Should be true when no children are passed — toggles the empty slot. */
  isEmpty?: boolean;
  /** From UserPreferences.preferredView. TIMELINE falls back to grid. */
  view?: "LIST" | "GRID" | "TIMELINE";
  className?: string;
}

export function CourseGrid({
  children,
  empty,
  isEmpty,
  view = "GRID",
  className,
}: CourseGridProps) {
  if (isEmpty) {
    return <div className={className}>{empty}</div>;
  }

  const list = view === "LIST";
  return (
    <div
      data-view={list ? "list" : "grid"}
      className={cn(
        list ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
