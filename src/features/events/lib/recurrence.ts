/**
 * Recurring-event expansion. Pure — no Prisma, no I/O, safe to unit test.
 *
 * A CourseEvent row stores the FIRST occurrence in `date` plus a small
 * RRULE-ish description of how it repeats. Later occurrences are derived
 * here at read time rather than being written as rows, so editing or
 * deleting a series is a single-record operation and a long-running weekly
 * event doesn't put 200 rows in the table.
 *
 * Deliberate simplifications versus iCal RRULE:
 *   - No BYMONTHDAY / BYSETPOS / "last Friday of the month".
 *   - Monthly and yearly steps CLAMP to the end of a short month, so a
 *     series starting on the 31st lands on the 30th in April and the 28th
 *     (or 29th) in February. Clamping is predictable and never skips a
 *     month, which is what a tutor scheduling a monthly review expects.
 *   - Weekdays, month days and times of day are read in one IANA zone
 *     (default Africa/Johannesburg), never the runtime's own. Vercel runs
 *     in UTC, so a Monday 00:30 class would otherwise repeat on Sundays.
 *     Arithmetic happens on "wall" dates whose UTC fields hold the
 *     zone's wall-clock time; each occurrence converts back to an instant,
 *     so a zone with daylight saving keeps the same local time.
 */

import { DEFAULT_TIME_ZONE, DEFAULT_LOCALE } from "@/lib/datetime";

export type RepeatFrequency =
  | "NONE"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY";

export interface RecurrenceRule {
  repeatFrequency: RepeatFrequency;
  /** Every N periods. Values below 1 are treated as 1. */
  repeatInterval: number;
  /** WEEKLY only. 0 = Sunday … 6 = Saturday. Empty = same weekday as start. */
  repeatWeekdays: number[];
  /** Inclusive end of the series, or null for open-ended. */
  repeatUntil: Date | null;
  /** Total occurrences including the first, or null for unlimited. */
  repeatCount: number | null;
}

/**
 * Safety valve. An open-ended daily series that started years ago would
 * otherwise iterate forever before reaching the window; this bounds the
 * work regardless of input.
 */
const MAX_STEPS = 5000;

/** Largest number of occurrences a single expansion will return. */
const MAX_RESULTS = 500;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** The instant's wall-clock time in `timeZone`, held in a Date's UTC fields. */
function toWall(instant: Date, timeZone: string): Date {
  const p: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) +
      instant.getUTCMilliseconds(),
  );
}

/**
 * The instant at which `timeZone` shows the wall time `wall`. Two passes
 * settle the offset; a wall time skipped by a DST jump lands just after it.
 */
function fromWall(wall: Date, timeZone: string): Date {
  const offsetAt = (t: number) =>
    toWall(new Date(t), timeZone).getTime() - t;
  const guess = wall.getTime() - offsetAt(wall.getTime());
  return new Date(wall.getTime() - offsetAt(guess));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Add months while keeping the intended day-of-month where possible.
 * `anchorDay` is the day the series started on, so a 31st series returns to
 * the 31st in months that have one instead of drifting to the 28th.
 */
function addMonthsClamped(d: Date, n: number, anchorDay: number): Date {
  const out = new Date(d);
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + n);
  const lastDay = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0),
  ).getUTCDate();
  out.setUTCDate(Math.min(anchorDay, lastDay));
  return out;
}

function addYearsClamped(d: Date, n: number, anchorDay: number): Date {
  return addMonthsClamped(d, n * 12, anchorDay);
}

/** Start of the week (Sunday) containing `d`, preserving time-of-day. */
function weekStart(d: Date): Date {
  return addDays(d, -d.getUTCDay());
}

function normaliseInterval(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Describe a rule in one line, for the event form and list rows.
 * Returns null for a non-repeating event.
 */
export function describeRecurrence(rule: RecurrenceRule): string | null {
  const freq = rule.repeatFrequency;
  if (freq === "NONE") return null;

  const n = normaliseInterval(rule.repeatInterval);
  const unit =
    freq === "DAILY"
      ? "day"
      : freq === "WEEKLY"
        ? "week"
        : freq === "MONTHLY"
          ? "month"
          : "year";
  let out = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;

  if (freq === "WEEKLY" && rule.repeatWeekdays.length > 0) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = [...rule.repeatWeekdays]
      .filter((d) => d >= 0 && d <= 6)
      .sort((a, b) => a - b)
      .map((d) => names[d]);
    if (days.length > 0) out += ` on ${days.join(", ")}`;
  }

  if (rule.repeatCount != null) {
    out += `, ${rule.repeatCount} times`;
  } else if (rule.repeatUntil) {
    out += `, until ${rule.repeatUntil.toLocaleDateString(DEFAULT_LOCALE, {
      timeZone: DEFAULT_TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return out;
}

/**
 * Every occurrence of `start` under `rule` that falls inside
 * [windowStart, windowEnd].
 *
 * `repeatCount` counts from the beginning of the series, not from the
 * window, so occurrences before the window still consume the budget.
 *
 * `timeZone` is the zone the series is defined in: its weekdays, month days
 * and time of day.
 */
export function expandOccurrences(
  start: Date,
  rule: RecurrenceRule,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date[] {
  const out: Date[] = [];

  const inWindow = (d: Date) =>
    d.getTime() >= windowStart.getTime() && d.getTime() <= windowEnd.getTime();

  if (rule.repeatFrequency === "NONE") {
    return inWindow(start) ? [start] : [];
  }

  const interval = normaliseInterval(rule.repeatInterval);
  const until = rule.repeatUntil;
  const limit = rule.repeatCount != null && rule.repeatCount > 0
    ? rule.repeatCount
    : null;
  const startWall = toWall(start, timeZone);
  const anchorDay = startWall.getUTCDate();

  let emitted = 0; // counts occurrences in the SERIES, window or not

  /** @returns false when the series is over and iteration should stop. */
  function consider(wall: Date): boolean {
    const d = fromWall(wall, timeZone);
    if (until && d.getTime() > until.getTime()) return false;
    if (limit != null && emitted >= limit) return false;
    emitted += 1;
    if (d.getTime() > windowEnd.getTime()) return false;
    if (inWindow(d)) out.push(d);
    return out.length < MAX_RESULTS;
  }

  if (rule.repeatFrequency === "WEEKLY" && rule.repeatWeekdays.length > 0) {
    const days = [...new Set(rule.repeatWeekdays)]
      .filter((d) => d >= 0 && d <= 6)
      .sort((a, b) => a - b);
    const firstWeek = weekStart(startWall);

    for (let step = 0; step < MAX_STEPS; step++) {
      const base = addDays(firstWeek, step * interval * 7);
      // Whole week already past the window end — nothing later can qualify.
      if (base.getTime() > windowEnd.getTime() + 7 * 864e5) break;
      for (const day of days) {
        const occ = addDays(base, day);
        // The series cannot begin before its own start date.
        if (occ.getTime() < startWall.getTime()) continue;
        if (!consider(occ)) return out;
      }
    }
    return out;
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    let occ: Date;
    switch (rule.repeatFrequency) {
      case "DAILY":
        occ = addDays(startWall, step * interval);
        break;
      case "WEEKLY":
        occ = addDays(startWall, step * interval * 7);
        break;
      case "MONTHLY":
        occ = addMonthsClamped(startWall, step * interval, anchorDay);
        break;
      case "YEARLY":
        occ = addYearsClamped(startWall, step * interval, anchorDay);
        break;
      default:
        return out;
    }
    if (!consider(occ)) return out;
  }

  return out;
}

/**
 * Convenience wrapper for the calendar: takes any row carrying the
 * recurrence columns and returns `[occurrenceDate, ...]`.
 */
export function occurrencesOf(
  event: { date: Date } & Partial<RecurrenceRule>,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date[] {
  return expandOccurrences(
    event.date,
    {
      repeatFrequency: event.repeatFrequency ?? "NONE",
      repeatInterval: event.repeatInterval ?? 1,
      repeatWeekdays: event.repeatWeekdays ?? [],
      repeatUntil: event.repeatUntil ?? null,
      repeatCount: event.repeatCount ?? null,
    },
    windowStart,
    windowEnd,
    timeZone,
  );
}
