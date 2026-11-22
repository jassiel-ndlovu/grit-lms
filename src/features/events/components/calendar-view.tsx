"use client";

/**
 * CalendarView — the calendar body (#149): month, week, day and agenda.
 *
 * The page works out the days and loads the entries (A's
 * `listCalendarOccurrences`, plus tests and assignments due) for exactly
 * those days; the view switch and the date stepper are links in the
 * page's ribbon, so this only lays the entries out and opens one.
 *
 * Every date is a day key in the viewer's zone (lib/calendar-ui.ts), so
 * the server render and the browser agree. Below 640 px the month grid
 * shows dots and each day links to the day view; the week stacks its days.
 */

import * as React from "react";
import Link from "next/link";
import { Ban, Repeat, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { calendarRoutes, dayLabel, groupByDay, joinOpen, type CalendarEntry, type CalendarViewMode } from "../lib/calendar-ui";
import { EntryDialog, type EntryContext } from "./entry-dialog";
import { iconFor, labelFor } from "./entry-meta";

export type { CalendarEntry };

export interface CalendarViewProps {
  view: CalendarViewMode;
  /** The days on screen, first to last (lib/calendar-ui `daysFor`). */
  days: string[];
  /** The anchor day: the month shown, or the day. */
  anchor: string;
  today: string;
  entries: CalendarEntry[];
  /** Shown when the range has nothing in it (day and agenda). */
  empty: React.ReactNode;
  /** Parent view: keeps `?child=` on the day links. */
  child?: string | null;
  ctx: EntryContext;
}

const WEEK_HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ view, days, anchor, today, entries, empty, child, ctx }: CalendarViewProps) {
  const [open, setOpen] = React.useState<CalendarEntry | null>(null);
  const byDay = React.useMemo(() => groupByDay(entries, ctx.timeZone), [entries, ctx.timeZone]);
  const time = React.useMemo(() => new Intl.DateTimeFormat(ctx.locale, { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone }), [ctx.locale, ctx.timeZone]);
  const dayHref = (d: string) => calendarRoutes.view({ view: "day", date: d, child });

  const chip = (e: CalendarEntry, withTime: boolean) => {
    const Icon = iconFor(e);
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => setOpen(e)}
        title={e.title}
        className={cn(
          "focus-visible:ring-ring flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs outline-none focus-visible:ring-2",
          e.kind === "event" ? "bg-primary/10 text-foreground hover:bg-primary/15" : "bg-muted text-muted-foreground hover:bg-muted/70",
          e.cancelled && "line-through opacity-60",
        )}
      >
        {withTime ? (
          // Week columns are narrow: time on one line, up to two lines of title.
          <span className="min-w-0">
            <span className="flex items-center gap-1 tabular-nums">
              <Icon aria-hidden className="size-3 shrink-0" />
              {time.format(new Date(e.start))}
            </span>
            <span className="line-clamp-2 break-words">{e.title}</span>
          </span>
        ) : (
          <>
            <Icon aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{e.title}</span>
          </>
        )}
      </button>
    );
  };

  let body: React.ReactNode;
  if (view === "month") {
    const month = anchor.slice(0, 7);
    body = (
      <Card className="overflow-hidden p-0">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-7 border-b text-xs">
          {WEEK_HEAD.map((d) => (
            <div key={d} className="px-1 py-2 text-center font-medium">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn("border-border min-h-14 border-r border-b p-1 sm:min-h-24 sm:p-1.5", i % 7 === 6 && "border-r-0", i >= 35 && "border-b-0", !inMonth && "bg-muted/20")}
              >
                <Link
                  href={dayHref(d)}
                  aria-label={`${dayLabel(d, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}${list.length ? `, ${list.length} ${list.length === 1 ? "item" : "items"}` : ""}`}
                  className={cn(
                    "focus-visible:ring-ring mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums outline-none hover:underline focus-visible:ring-2",
                    isToday ? "bg-foreground text-background font-medium" : inMonth ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {Number(d.slice(8))}
                </Link>
                {/* Phones: one dot per item, up to three. */}
                {list.length > 0 && (
                  <Link href={dayHref(d)} tabIndex={-1} aria-hidden className="flex gap-0.5 pl-1 sm:hidden">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={cn("size-1.5 rounded-full", e.kind === "event" ? "bg-foreground" : "bg-muted-foreground/50", e.cancelled && "opacity-30")} />
                    ))}
                  </Link>
                )}
                <div className="hidden space-y-1 sm:block">
                  {list.slice(0, 3).map((e) => chip(e, false))}
                  {list.length > 3 && (
                    <Link href={dayHref(d)} className="text-muted-foreground hover:text-foreground block px-1.5 text-xs">
                      +{list.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  } else if (view === "week") {
    body = (
      <>
        {/* Wide screens: seven columns. */}
        <Card className="hidden overflow-hidden p-0 md:block">
          <div className="grid grid-cols-7 divide-x">
            {days.map((d) => (
              <div key={d} className="min-h-64">
                <Link
                  href={dayHref(d)}
                  className={cn("hover:bg-accent/50 block border-b px-2 py-2 text-center text-xs", d === today ? "text-foreground font-semibold" : "text-muted-foreground")}
                >
                  {dayLabel(d, ctx.locale, { weekday: "short", day: "numeric" })}
                </Link>
                <div className="space-y-1 p-1.5">{(byDay.get(d) ?? []).map((e) => chip(e, true))}</div>
              </div>
            ))}
          </div>
        </Card>
        {/* Phones: the days stacked. */}
        <div className="space-y-4 md:hidden">
          {days.map((d) => (
            <DayGroup key={d} day={d} today={today} entries={byDay.get(d) ?? []} ctx={ctx} time={time} onOpen={setOpen} showEmpty />
          ))}
        </div>
      </>
    );
  } else {
    const shown = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0);
    body =
      shown.length === 0 ? (
        empty
      ) : (
        <div className="space-y-4">
          {shown.map((d) => (
            <DayGroup key={d} day={d} today={today} entries={byDay.get(d)!} ctx={ctx} time={time} onOpen={setOpen} hideHeading={view === "day"} />
          ))}
        </div>
      );
  }

  return (
    <>
      {body}
      <EntryDialog entry={open} onClose={() => setOpen(null)} ctx={ctx} />
    </>
  );
}

function DayGroup({
  day, today, entries, ctx, time, onOpen, showEmpty = false, hideHeading = false,
}: {
  day: string;
  today: string;
  entries: CalendarEntry[];
  ctx: EntryContext;
  time: Intl.DateTimeFormat;
  onOpen: (e: CalendarEntry) => void;
  showEmpty?: boolean;
  hideHeading?: boolean;
}) {
  if (!showEmpty && entries.length === 0) return null;
  return (
    <section aria-label={dayLabel(day, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}>
      {!hideHeading && (
        <h2 className={cn("mb-1.5 text-sm", day === today ? "text-foreground font-semibold" : "text-muted-foreground font-medium")}>
          {dayLabel(day, ctx.locale, { weekday: "long", day: "numeric", month: "short" })}
          {day === today ? " · Today" : ""}
        </h2>
      )}
      {entries.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border border-dashed px-3 py-2 text-xs">Nothing on</p>
      ) : (
        <Card className="divide-border divide-y overflow-hidden p-0">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} time={time} onOpen={onOpen} />
          ))}
        </Card>
      )}
    </section>
  );
}

function EntryRow({ entry: e, time, onOpen }: { entry: CalendarEntry; time: Intl.DateTimeFormat; onOpen: (e: CalendarEntry) => void }) {
  const Icon = iconFor(e);
  const live = e.link && joinOpen(e, new Date());
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <button type="button" onClick={() => onOpen(e)} className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded text-left outline-none focus-visible:ring-2">
        <span className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums">
          {time.format(new Date(e.start))}
          {e.end ? (
            <>
              <br />
              {time.format(new Date(e.end))}
            </>
          ) : null}
        </span>
        <span className={cn("bg-muted text-foreground grid size-8 shrink-0 place-items-center rounded-md", e.cancelled && "opacity-50")}>
          <Icon aria-hidden className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", e.cancelled && "text-muted-foreground line-through")}>{e.title}</span>
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span className="truncate">{e.courseName}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{labelFor(e)}</span>
            {e.recurring ? <Repeat aria-label="Repeats" className="size-3 shrink-0" /> : null}
          </span>
        </span>
      </button>
      {e.cancelled ? (
        <Badge variant="secondary" className="shrink-0">
          <Ban aria-hidden className="size-3" />
          Cancelled
        </Badge>
      ) : e.changed ? (
        <Badge variant="outline" className="shrink-0">
          Changed
        </Badge>
      ) : null}
      {live ? (
        <a href={e.link!} target="_blank" rel="noreferrer" className="bg-primary text-primary-foreground inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-sm font-medium">
          <Timer aria-hidden className="size-3.5" />
          Join
        </a>
      ) : null}
    </div>
  );
}
