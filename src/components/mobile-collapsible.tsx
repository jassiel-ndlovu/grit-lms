"use client";

/**
 * MobileCollapsible — a section that is always open on lg+ and collapses
 * behind a toggle on smaller screens.
 *
 * For sidebars (lesson lists, question lists) that sit beside the content
 * on desktop but would stack above it on a phone and push the content a
 * screen or more down the page.
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface MobileCollapsibleProps {
  /** Toggle text, e.g. "Lessons (12)". */
  label: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function MobileCollapsible({
  label,
  children,
  defaultOpen = false,
  className,
}: MobileCollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="border-border bg-card text-foreground hover:bg-muted/60 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors lg:hidden"
      >
        {label}
        <ChevronDown
          className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      <div id={id} className={cn("mt-3 lg:mt-0 lg:block", !open && "hidden")}>
        {children}
      </div>
    </div>
  );
}
