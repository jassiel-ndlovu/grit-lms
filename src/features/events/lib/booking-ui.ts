/**
 * Session booking screens: routes, the weekly hours form and wording
 * (viewer.md Draft 1.21). Pure. Slots, rules and actions are A's
 * (features/booking). Checked by scripts/check-booking-ui.ts.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import { BOOKING_DEFAULTS, validateRules, type AvailabilityRule } from "@/features/booking/booking-math";

import { addDays, dayKeyOf, dayLabel, splitInZone } from "./calendar-ui";

export type BookingView = "upcoming" | "past";
export type BookingStatusName = "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

const query = (base: string, q: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
};

export const bookingRoutes = {
  home: "/dashboard/bookings",
  /** Families: upcoming or past. */
  list: (view: BookingView) => query("/dashboard/bookings", { view: view === "past" ? "past" : null }),
  /** Staff: one week, their own unless a course or a tutor is picked. */
  week: (p: { week?: string | null; course?: string | null; tutor?: string | null } = {}) =>
    query("/dashboard/bookings", { week: p.week, course: p.course, tutor: p.tutor }),
  book: (p: { course?: string | null; student?: string | null; week?: string | null; tutor?: string | null } = {}) =>
    query("/dashboard/bookings/book", { course: p.course, student: p.student, week: p.week, tutor: p.tutor }),
  hours: (tutor?: string | null) => query("/dashboard/bookings/hours", { tutor }),
};

export function parseBookingView(raw: string | string[] | undefined): BookingView {
  return raw === "past" ? "past" : "upcoming";
}

/* ------------------------------------------------------------------------- */
/* Weekly hours                                                              */
/* ------------------------------------------------------------------------- */

/** Monday first, as `weekday` numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const SLOT_LENGTHS = [30, 45, 60, 90, 120] as const;
export const GAPS = [0, 5, 10, 15, 30] as const;

/** One line of the form: wall times as `HH:MM`. */
export type HoursRow = {
  key: string;
  weekday: number;
  start: string;
  end: string;
  slotMinutes: number;
  bufferMinutes: number;
  courseId: string | null;
};
export type HoursRule = AvailabilityRule & { courseId: string | null };

/** "15:30" → 930. Null when it isn't a time. */
export function minutesOf(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

/** 930 → "15:30"; midnight at the end of the day (1440) → "00:00". */
export function timeOf(minute: number): string {
  const m = minute % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function rowsFrom(rules: ReadonlyArray<HoursRule & { id?: string }>): HoursRow[] {
  return rules.map((r, i) => ({
    key: r.id ?? `r${i}`,
    weekday: r.weekday,
    start: timeOf(r.startMinute),
    end: timeOf(r.endMinute),
    slotMinutes: r.slotMinutes,
    bufferMinutes: r.bufferMinutes,
    courseId: r.courseId,
  }));
}

function ruleOf(row: HoursRow): HoursRule | null {
  const start = minutesOf(row.start);
  const end = minutesOf(row.end);
  if (start === null || end === null) return null;
  // "00:00" as an end is midnight, the end of the day.
  return {
    weekday: row.weekday,
    startMinute: start,
    endMinute: end === 0 ? 1440 : end,
    slotMinutes: row.slotMinutes,
    bufferMinutes: row.bufferMinutes,
    courseId: row.courseId,
  };
}

/** The rules to save, or what's wrong (A's rules, with the day named). */
export function rulesFrom(rows: readonly HoursRow[]): { rules: HoursRule[] } | { error: string } {
  const rules: HoursRule[] = [];
  for (const row of rows) {
    const r = ruleOf(row);
    const day = WEEKDAY_NAME[row.weekday];
    if (!r) return { error: `${day}: fill in both times.` };
    const alone = validateRules([r]);
    if (alone) return { error: `${day}: ${alone.charAt(0).toLowerCase()}${alone.slice(1)}` };
    if (validateRules([...rules, r])) return { error: `${day}: two times overlap.` };
    rules.push(r);
  }
  return { rules };
}

/** How many lessons fit in a line. 0 when the times don't work. */
export function lessonsIn(row: HoursRow): number {
  const r = ruleOf(row);
  if (!r || r.endMinute - r.startMinute < r.slotMinutes) return 0;
  return Math.floor((r.endMinute - r.startMinute + r.bufferMinutes) / (r.slotMinutes + r.bufferMinutes));
}

/** A new line for a day: an hour after the last one there, or 14:00 to 17:00. */
export function nextRow(rows: readonly HoursRow[], weekday: number, key: string): HoursRow {
  const sameDay = rows.filter((r) => r.weekday === weekday);
  const last = sameDay[sameDay.length - 1];
  const like = last ?? rows[rows.length - 1];
  const slotMinutes = like?.slotMinutes ?? BOOKING_DEFAULTS.slotMinutes;
  const lastEnd = last ? minutesOf(last.end) : null;
  // Too late in the day for another line after it: start at 08:00 instead.
  const start = !last ? 14 * 60 : lastEnd && lastEnd + 60 + slotMinutes <= 1440 ? lastEnd + 60 : 8 * 60;
  return {
    key,
    weekday,
    start: timeOf(start),
    end: timeOf(Math.min(1440, start + (last ? slotMinutes : Math.max(slotMinutes, 180)))),
    slotMinutes,
    bufferMinutes: like?.bufferMinutes ?? BOOKING_DEFAULTS.bufferMinutes,
    courseId: like?.courseId ?? null,
  };
}

/* ------------------------------------------------------------------------- */
/* Lists and slots                                                           */
/* ------------------------------------------------------------------------- */

/** Anything with a start, by day in a zone, days and items in time order. */
export function byDay<T>(items: readonly T[], startOf: (t: T) => Date, timeZone: string): Array<{ day: string; items: T[] }> {
  const out = new Map<string, T[]>();
  for (const t of [...items].sort((a, b) => startOf(a).getTime() - startOf(b).getTime())) {
    const k = dayKeyOf(startOf(t), timeZone);
    const list = out.get(k);
    if (list) list.push(t);
    else out.set(k, [t]);
  }
  return [...out].map(([day, list]) => ({ day, items: list }));
}

/** The first day at or after `from` with a free slot, or null. */
export function firstFreeDay(slots: ReadonlyArray<{ start: Date }>, from: string, timeZone: string): string | null {
  const days = slots.map((s) => dayKeyOf(s.start, timeZone)).filter((d) => d >= from);
  return days.length ? days.reduce((a, b) => (a < b ? a : b)) : null;
}

/** The last day anyone can book, `horizonDays` ahead. */
export function lastBookableDay(today: string, horizonDays: number): string {
  return addDays(today, horizonDays);
}

export function bookingChip(b: { status: BookingStatusName; endsAt: Date }, now: Date): { label: string; tone: StatusTone } {
  switch (b.status) {
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    case "COMPLETED":
      return { label: "Done", tone: "success" };
    case "NO_SHOW":
      return { label: "No-show", tone: "danger" };
    default:
      return b.endsAt <= now ? { label: "Not marked", tone: "warning" } : { label: "Booked", tone: "info" };
  }
}

/** What the cancel dialog says. */
export function cancelNote(b: { usedCredit: boolean; cancelReturnsCredit: boolean }, staff: boolean): string {
  if (staff) return b.usedCredit ? "The family is emailed, and the lesson goes back on the pack." : "The family is emailed.";
  if (!b.usedCredit) return "The tutor is emailed.";
  return b.cancelReturnsCredit
    ? "The tutor is emailed. You'll get the lesson back."
    : "The tutor is emailed. It's too close to the lesson, so it won't go back on the pack.";
}

export function cancelledToast(creditReturned: boolean, usedCredit: boolean): string {
  if (!usedCredit) return "Lesson cancelled.";
  return creditReturned ? "Lesson cancelled. It's back on the pack." : "Lesson cancelled. It didn't go back on the pack.";
}

export function lessonsLeft(n: number): string {
  return n === 1 ? "1 lesson left" : `${n} lessons left`;
}

/** 24 → "24 hours", 48 → "2 days", 1 → "1 hour". */
export function hoursLabel(hours: number): string {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** The cancel rule, for someone about to use a lesson from a pack. */
export function cancelRule(cancelHours: number): string {
  return cancelHours === 0
    ? "Cancel before it starts and you'll get the lesson back."
    : `Cancel at least ${hoursLabel(cancelHours)} before and you'll get the lesson back.`;
}

export type BookingPolicy = { cancelHours: number; leadHours: number; horizonDays: number };
export const POLICY_LIMITS: Record<keyof BookingPolicy, [number, number]> = {
  cancelHours: [0, 168],
  leadHours: [0, 168],
  horizonDays: [1, 180],
};

/** The policy form's numbers, or what's wrong. */
export function parsePolicy(form: Record<keyof BookingPolicy, string>): { policy: BookingPolicy } | { error: string } {
  const policy: BookingPolicy = { cancelHours: 0, leadHours: 0, horizonDays: 0 };
  for (const k of ["leadHours", "horizonDays", "cancelHours"] as const) {
    const raw = form[k].trim();
    const n = Number(raw);
    const [lo, hi] = POLICY_LIMITS[k];
    if (!raw || !Number.isInteger(n) || n < lo || n > hi) {
      return { error: `Use a whole number of ${k === "horizonDays" ? "days" : "hours"} from ${lo} to ${hi}.` };
    }
    policy[k] = n;
  }
  return { policy };
}

/** Lessons to add (+) or take away (−): 1 to 100. Null when it isn't. */
export function parseAdjustment(raw: string, direction: "add" | "remove"): number | null {
  const t = raw.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  if (n < 1 || n > 100) return null;
  return direction === "add" ? n : -n;
}

/** After adding time off: lessons already booked in it. */
export function timeOffWarning(bookingsInside: number): string | null {
  if (bookingsInside === 0) return null;
  return bookingsInside === 1
    ? "1 lesson is already booked in that time. Cancel it if you can't make it."
    : `${bookingsInside} lessons are already booked in that time. Cancel them if you can't make them.`;
}

/** "Mon 1 Dec – Fri 5 Dec" for whole days, "Mon 1 Dec, 08:00–12:00" otherwise. */
export function timeOffLabel(t: { startsAt: Date; endsAt: Date }, timeZone: string, locale: string): string {
  const from = splitInZone(t.startsAt, timeZone);
  const to = splitInZone(t.endsAt, timeZone);
  if (from.time === "00:00" && to.time === "00:00") {
    const last = addDays(to.date, -1);
    return last <= from.date ? dayLabel(from.date, locale) : `${dayLabel(from.date, locale)} – ${dayLabel(last, locale)}`;
  }
  return from.date === to.date
    ? `${dayLabel(from.date, locale)}, ${from.time}–${to.time}`
    : `${dayLabel(from.date, locale)}, ${from.time} – ${dayLabel(to.date, locale)}, ${to.time}`;
}
