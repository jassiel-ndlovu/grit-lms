"use client";

/**
 * CalendarView - month-grid client component for the schedule page.
 *
 * Owns nothing server-side - it receives a flat list of CalendarItem rows
 * (events, tests, assignments) from the page wrapper and renders them in
 * a 6-week month grid. Click any item to open a Dialog with the full
 * details. Prev/next arrows shift the displayed month locally; the data
 * already covers an extended window so navigating doesn't refetch.
 */

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Megaphone,
  Pencil,
  Presentation,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type CalendarKind = "event" | "test" | "assignment";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  /** Underlying event type for CourseEvents (LECTURE/EXAM/etc.); ignored for tests/assignments. */
  type?: string;
  title: string;
  /** Date the item is anchored to (event start, due date, etc.). */
  date: Date;
  course: { id: string; name: string };
  description?: string | null;
  location?: string | null;
  duration?: number | null;
  link?: string | null;
  /** Where to send the user when they click "Open" in the detail dialog. */
  href?: string | null;
}

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const monthFmt = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setDate(d.getDate() - d.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function iconFor(item: CalendarItem) {
  if (item.kind === "test") return Pencil;
  if (item.kind === "assignment") return Pencil;
  switch (item.type) {
    case "LECTURE":
      return Presentation;
    case "EXAM":
      return GraduationCap;
    case "REMINDER":
      return Megaphone;
    case "LIVE":
    case "MEETING":
      return Timer;
    default:
      return CalendarDays;
  }
}

function labelFor(item: CalendarItem): string {
  if (item.kind === "test") return "Test due";
  if (item.kind === "assignment") return "Assignment due";
  switch (item.type) {
    case "LECTURE": return "Lecture";
    case "EXAM": return "Exam";
    case "REMINDER": return "Reminder";
    case "LIVE": return "Live session";
    case "MEETING": return "Meeting";
    case "TEST": return "Test";
    case "SUBMISSION": return "Assignment";
    case "HOLIDAY": return "Holiday";
    default: return "Event";
  }
}

export interface CalendarViewProps {
  items: CalendarItem[];
}

export function CalendarView({ items }: CalendarViewProps) {
  const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));
  const [open, setOpen] = React.useState<CalendarItem | null>(null);

  // Build the 6-week grid: start from the Sunday on/before the 1st of the
  // current month and lay out 42 cells.
  const gridStart = startOfWeek(startOfMonth(cursor));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  // Bucket items by yyyy-mm-dd for fast lookup as we render the grid.
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;
    const list = byDay.get(key);
    if (list) list.push(item);
    else byDay.set(key, [item]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="font-display min-w-44 text-center text-lg leading-tight tracking-tight text-foreground">
            {monthFmt.format(cursor)}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCursor(startOfMonth(new Date()))}
        >
          Today
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-muted-foreground text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = isSameDay(day, today);
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const cellItems = byDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={cn(
                  "border-border min-h-24 border-r border-b p-1.5 last:border-r-0",
                  i % 7 === 6 && "border-r-0",
                  i >= 35 && "border-b-0",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    isToday
                      ? "bg-brand-terracotta text-primary-foreground font-medium"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {cellItems.slice(0, 3).map((item) => {
                    const Icon = iconFor(item);
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        onClick={() => setOpen(item)}
                        className={cn(
                          "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] transition-colors",
                          "bg-brand-terracotta/12 text-brand-terracotta hover:bg-brand-terracotta/20",
                        )}
                        title={item.title}
                      >
                        <Icon className="size-3 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                  {cellItems.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setOpen(cellItems[3])}
                      className="text-muted-foreground hover:text-foreground w-full px-1.5 text-left text-[11px]"
                    >
                      +{cellItems.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail dialog — opens when any cell item is clicked. */}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          {open && <EventDetailBody item={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventDetailBody({ item }: { item: CalendarItem }) {
  const Icon = iconFor(item);
  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 items-center justify-center rounded-md shrink-0">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-xl leading-tight tracking-tight">
              {item.title}
            </DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{labelFor(item)}</Badge>
              <span className="truncate text-xs">{item.course.name}</span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <Separator />

      <div className="space-y-3 text-sm">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <CalendarDays className="size-3.5" />
          <span className="tabular-nums">
            {dayFmt.format(item.date)} · {timeFmt.format(item.date)}
            {item.duration ? ` · ${item.duration} min` : ""}
          </span>
        </div>
        {item.location && (
          <p className="text-foreground text-sm">
            <span className="text-muted-foreground text-xs">Location: </span>
            {item.location}
          </p>
        )}
        {item.description && (
          <p className="text-foreground whitespace-pre-wrap text-sm">
            {item.description}
          </p>
        )}
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="text-brand-terracotta inline-flex items-center gap-1 text-sm hover:underline"
          >
            Open link
            <ExternalLink className="size-3" />
          </a>
        )}
        {item.href && (
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={item.href}>Go to {labelFor(item).toLowerCase()}</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
