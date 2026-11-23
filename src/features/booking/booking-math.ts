/**
 * Session booking arithmetic (#216 phase 2, Plus). Pure: the check script
 * covers it. Availability is weekly rules in the tutor's time zone, minus
 * time off, minus anything already busy (bookings and the tutor's classes).
 */

export type AvailabilityRule = {
  /** 0 = Sunday … 6 = Saturday, in `timeZone`. */
  weekday: number;
  /** Minutes after local midnight. */
  startMinute: number;
  endMinute: number;
  /** Length of one booking. */
  slotMinutes: number;
  /** Gap kept after each booking. */
  bufferMinutes: number;
};

export type Span = { start: Date; end: Date };

export const BOOKING_DEFAULTS = {
  slotMinutes: 60,
  bufferMinutes: 0,
  /** Book at least this long ahead. */
  leadHours: 12,
  /** And at most this far ahead. */
  horizonDays: 28,
  /** Cancel at least this long before for the lesson credit back. */
  cancelHours: 24,
  timeZone: "Africa/Johannesburg",
} as const;

const MIN = 60_000;
const DAY = 86_400_000;

/** The wall-clock parts of `at` in `timeZone`. */
export function zonedParts(at: Date, timeZone: string): { y: number; m: number; d: number; h: number; mi: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), h: Number(get("hour")) % 24, mi: Number(get("minute")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

/** The instant when the wall clock in `timeZone` shows y-m-d plus `minute` minutes. */
export function zonedTime(y: number, m: number, d: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, minute);
  const offset = (at: number) => {
    const p = zonedParts(new Date(at), timeZone);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - at;
  };
  let t = guess - offset(guess);
  // Once more, for a date where the offset changes (daylight saving elsewhere).
  t = guess - offset(t);
  return new Date(t);
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Free slots between `from` and `to`: each rule's day cut into
 * slot + buffer steps, keeping those that start after now + lead time and
 * before now + horizon, and don't touch time off or busy spans (buffer
 * included). Sorted, without duplicates.
 */
export function freeSlots(input: {
  from: Date;
  to: Date;
  now: Date;
  timeZone: string;
  rules: AvailabilityRule[];
  timeOff: Span[];
  busy: Span[];
  leadHours?: number;
  horizonDays?: number;
}): Span[] {
  const lead = (input.leadHours ?? BOOKING_DEFAULTS.leadHours) * 3_600_000;
  const horizon = (input.horizonDays ?? BOOKING_DEFAULTS.horizonDays) * DAY;
  const earliest = new Date(Math.max(input.from.getTime(), input.now.getTime() + lead));
  const latest = new Date(Math.min(input.to.getTime(), input.now.getTime() + horizon));
  if (earliest >= latest) return [];
  const blocked = [...input.timeOff, ...input.busy];
  const out = new Map<number, Span>();
  // Walk local days from the day before `earliest` (time zones) to `latest`.
  for (let t = earliest.getTime() - DAY; t <= latest.getTime() + DAY; t += DAY) {
    const p = zonedParts(new Date(t), input.timeZone);
    for (const r of input.rules) {
      if (r.weekday !== p.weekday || r.slotMinutes <= 0 || r.endMinute <= r.startMinute) continue;
      const step = r.slotMinutes + Math.max(0, r.bufferMinutes);
      for (let m = r.startMinute; m + r.slotMinutes <= r.endMinute; m += step) {
        const start = zonedTime(p.y, p.m, p.d, m, input.timeZone);
        const end = new Date(start.getTime() + r.slotMinutes * MIN);
        if (start < earliest || start >= latest) continue;
        const withBuffer = { start, end: new Date(end.getTime() + Math.max(0, r.bufferMinutes) * MIN) };
        if (blocked.some((b) => overlaps(withBuffer, b))) continue;
        out.set(start.getTime(), { start, end });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** True when `slot` is one of the free slots (a booking must match exactly). */
export function isFreeSlot(slot: Span, free: Span[]): boolean {
  return free.some((f) => f.start.getTime() === slot.start.getTime() && f.end.getTime() === slot.end.getTime());
}

/** A cancellation this long before the start gives the lesson back. */
export function refundsCredit(startsAt: Date, now: Date, cancelHours: number = BOOKING_DEFAULTS.cancelHours): boolean {
  return startsAt.getTime() - now.getTime() >= cancelHours * 3_600_000;
}

/** Checks a weekly rule set: valid days and times, and no overlaps on a day. */
export function validateRules(rules: AvailabilityRule[]): string | null {
  for (const r of rules) {
    if (!Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6) return "Pick a day of the week.";
    if (r.startMinute < 0 || r.endMinute > 24 * 60 || r.endMinute <= r.startMinute) return "Each time must end after it starts, on the same day.";
    if (r.slotMinutes < 15 || r.slotMinutes > 240) return "Lessons must be between 15 minutes and 4 hours.";
    if (r.bufferMinutes < 0 || r.bufferMinutes > 120) return "The gap between lessons must be 0 to 120 minutes.";
    if (r.endMinute - r.startMinute < r.slotMinutes) return "Each time must fit at least one lesson.";
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i], b = rules[j];
      if (a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute) return "Two times overlap on the same day.";
    }
  }
  return null;
}

/** Lesson credits left: the sum of the ledger (purchases +, bookings −, refunds +). */
export function creditBalance(entries: Array<{ lessons: number }>): number {
  return entries.reduce((n, e) => n + e.lessons, 0);
}
