"use client";

/**
 * The calendar's secondary header (#149, page frame #205): the view switch
 * (Month, Week, Day, Agenda) and the date stepper. All links, so the page
 * loads just the days it shows.
 */

import Link from "next/link";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RibbonNav, RibbonToolbar } from "@/components/shell/ribbon";
import { cn } from "@/lib/utils";

import { CALENDAR_VIEWS, calendarRoutes, stepAnchor, type CalendarViewMode } from "../lib/calendar-ui";

const STEP = "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-md px-1 text-sm sm:px-2 outline-none focus-visible:ring-2 [&_svg]:size-4";

export function CalendarRibbon({
  view, anchor, today, child, label,
}: {
  view: CalendarViewMode;
  anchor: string;
  today: string;
  child?: string | null;
  /** The range shown, e.g. "November 2026" (wide screens; phones see it in the title). */
  label: string;
}) {
  const href = (v: CalendarViewMode, date: string | null) => calendarRoutes.view({ view: v, date, child });
  const links = CALENDAR_VIEWS.map((v) => ({ label: v.label, href: href(v.value, anchor === today ? null : anchor) }));
  const current = href(view, anchor === today ? null : anchor);
  const unit = view === "month" ? "month" : view === "week" ? "week" : view === "day" ? "day" : "30 days";
  return (
    <>
      <RibbonNav label="Calendar views" links={links} current={current} className="flex-initial" />
      <RibbonToolbar label="Dates" className="-mr-2 ml-auto sm:mr-0">
        <span className="text-foreground hidden pr-2 text-sm font-medium lg:inline" aria-live="polite">
          {label}
        </span>
        <ToolbarPrimitive.Link asChild>
          <Link href={href(view, stepAnchor(view, anchor, -1))} className={STEP} aria-label={`Previous ${unit}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </ToolbarPrimitive.Link>
        <ToolbarPrimitive.Link asChild>
          <Link href={href(view, null)} className={cn(STEP, anchor === today && "text-foreground font-medium")} aria-current={anchor === today ? "date" : undefined}>
            Today
          </Link>
        </ToolbarPrimitive.Link>
        <ToolbarPrimitive.Link asChild>
          <Link href={href(view, stepAnchor(view, anchor, 1))} className={STEP} aria-label={`Next ${unit}`}>
            <ChevronRight aria-hidden />
          </Link>
        </ToolbarPrimitive.Link>
      </RibbonToolbar>
    </>
  );
}
