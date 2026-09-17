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
 *   - Times are handled in the server's local zone, matching how `date` is
 *     already read everywhere else in the app.
 */

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

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Add months while keeping the intended day-of-month where possible.
 * `anchorDay` is the day the series started on, so a 31st series returns to
 * the 31st in months that have one instead of drifting to the 28th.
 */
function addMonthsClamped(d: Date, n: number, anchorDay: number): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setMonth(out.getMonth() + n);
  const lastDay = new Date(
    out.getFullYear(),
    out.getMonth() + 1,
    0,
  ).getDate();
  out.setDate(Math.min(anchorDay, lastDay));
  return out;
}

function addYearsClamped(d: Date, n: number, anchorDay: number): Date {
  return addMonthsClamped(d, n * 12, anchorDay);
}

/** Start of the week (Sunday) containing `d`, preserving time-of-day. */
function weekStart(d: Date): Date {
  return addDays(d, -d.getDay());
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
    out += `, until ${rule.repeatUntil.toLocaleDateString(undefined, {
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
 */
export function expandOccurrences(
  start: Date,
  rule: RecurrenceRule,
  windowStart: Date,
  windowEnd: Date,
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
  const anchorDay = start.getDate();

  let emitted = 0; // counts occurrences in the SERIES, window or not

  /** @returns false when the series is over and iteration should stop. */
  function consider(d: Date): boolean {
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
    const firstWeek = weekStart(start);

    for (let step = 0; step < MAX_STEPS; step++) {
      const base = addDays(firstWeek, step * interval * 7);
      // Whole week already past the window end — nothing later can qualify.
      if (base.getTime() > windowEnd.getTime() + 7 * 864e5) break;
      for (const day of days) {
        const occ = addDays(base, day);
        // The series cannot begin before its own start date.
        if (occ.getTime() < start.getTime()) continue;
        if (!consider(occ)) return out;
      }
    }
    return out;
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    let occ: Date;
    switch (rule.repeatFrequency) {
      case "DAILY":
        occ = addDays(start, step * interval);
        break;
      case "WEEKLY":
        occ = addDays(start, step * interval * 7);
        break;
      case "MONTHLY":
        occ = addMonthsClamped(start, step * interval, anchorDay);
        break;
      case "YEARLY":
        occ = addYearsClamped(start, step * interval, anchorDay);
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
  );
}
