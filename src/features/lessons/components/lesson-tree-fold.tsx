"use client";

/**
 * Folds the lesson tree on small screens, so the editor isn't pushed below
 * a long tree. From `lg` the tree is always shown beside the editor and the
 * toggle is hidden. Open by default when no lesson is selected; the
 * workspace keys this by the selected lesson, so picking one folds it again.
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function LessonTreeFold({
  defaultOpen,
  summary,
  children,
}: {
  defaultOpen: boolean;
  /** What the closed toggle says, e.g. "2.1 · Limits". */
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="border-border hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm lg:hidden"
      >
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">Lessons</span>
          {summary ? <span className="text-foreground"> · {summary}</span> : null}
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} className={cn("mt-3 lg:mt-0 lg:block", open ? "block" : "hidden")}>
        {children}
      </div>
    </>
  );
}
