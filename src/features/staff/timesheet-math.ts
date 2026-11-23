/**
 * Tutor timesheets and cover (#216 phase 3, organisations): the pure parts,
 * covered by scripts/check-timesheets.ts.
 *
 * A month's timesheet is suggested from what the tutor taught: class
 * occurrences of their courses (minus any they were covered for, plus any
 * they covered) and booked lessons they completed or the student missed.
 * Tutors add other work (marking, preparation) by hand.
 */

export const TEACHING_TYPES = ["LECTURE", "LIVE", "EXAM"] as const;
export const ENTRY_KINDS = ["SESSION", "COVER", "BOOKING", "MANUAL"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const TIMESHEET_LIMITS = {
  /** A class with no length counts as this many minutes. */
  defaultSessionMinutes: 60,
  /** One manual entry, at most. */
  maxEntryMinutes: 12 * 60,
  /** Hourly rate, at most (rand cents). */
  maxHourlyCents: 1_000_000,
} as const;

export type OccurrenceIn = { eventId: string; occurrenceStart: string; start: string; end: string; type: string; cancelled: boolean; courseId: string; title: string };
export type BookingIn = { id: string; courseId: string; startsAt: Date; endsAt: Date; status: string };
export type SuggestedEntry = {
  kind: Exclude<EntryKind, "MANUAL">;
  key: string;
  courseId: string;
  startsAt: Date;
  minutes: number;
  label: string;
  eventId: string | null;
  occurrenceStart: Date | null;
  bookingId: string | null;
};

export const occurrenceKey = (eventId: string, occurrenceStart: string | Date) => `${eventId}@${new Date(occurrenceStart).toISOString()}`;

function minutesBetween(start: Date, end: Date): number {
  const m = Math.round((end.getTime() - start.getTime()) / 60_000);
  return m > 0 ? m : TIMESHEET_LIMITS.defaultSessionMinutes;
}

/**
 * The month's suggested entries for one tutor: their own classes (not
 * cancelled, a teaching type) unless someone covered them, the classes they
 * covered, and their bookings that happened (COMPLETED or NO_SHOW).
 */
export function suggestEntries(input: {
  own: OccurrenceIn[];
  coveredAway: Set<string>;
  coveredIn: OccurrenceIn[];
  bookings: BookingIn[];
}): SuggestedEntry[] {
  const out: SuggestedEntry[] = [];
  const teaching = (o: OccurrenceIn) => !o.cancelled && (TEACHING_TYPES as readonly string[]).includes(o.type);
  // A class they covered counts as cover, even if covering gave them access to its course.
  const coveringKeys = new Set(input.coveredIn.map((o) => occurrenceKey(o.eventId, o.occurrenceStart)));
  for (const o of input.own) {
    const key = occurrenceKey(o.eventId, o.occurrenceStart);
    if (!teaching(o) || input.coveredAway.has(key) || coveringKeys.has(key)) continue;
    out.push({ kind: "SESSION", key, courseId: o.courseId, startsAt: new Date(o.start), minutes: minutesBetween(new Date(o.start), new Date(o.end)), label: o.title, eventId: o.eventId, occurrenceStart: new Date(o.occurrenceStart), bookingId: null });
  }
  for (const o of input.coveredIn) {
    if (!teaching(o)) continue;
    const key = occurrenceKey(o.eventId, o.occurrenceStart);
    if (out.some((e) => e.key === key)) continue;
    out.push({ kind: "COVER", key, courseId: o.courseId, startsAt: new Date(o.start), minutes: minutesBetween(new Date(o.start), new Date(o.end)), label: `Cover: ${o.title}`, eventId: o.eventId, occurrenceStart: new Date(o.occurrenceStart), bookingId: null });
  }
  for (const b of input.bookings) {
    if (b.status !== "COMPLETED" && b.status !== "NO_SHOW") continue;
    out.push({ kind: "BOOKING", key: `booking:${b.id}`, courseId: b.courseId, startsAt: b.startsAt, minutes: minutesBetween(b.startsAt, b.endsAt), label: b.status === "NO_SHOW" ? "Booked lesson (student didn't come)" : "Booked lesson", eventId: null, occurrenceStart: null, bookingId: b.id });
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Pay for minutes at an hourly rate, in cents, rounded to the cent. */
export function payCents(minutes: number, hourlyCents: number): number {
  return Math.round((minutes * hourlyCents) / 60);
}

/** "2026-11" → the month's start and end instants in `timeZone` (start inclusive, end exclusive). */
export function monthRange(month: string, timeZone: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error("month must be YYYY-MM");
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error("month must be YYYY-MM");
  const at = (yy: number, mm: number) => {
    // Midnight local on the 1st: start from UTC midnight and correct by the zone's offset then.
    const guess = Date.UTC(yy, mm - 1, 1);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asLocal = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
    return new Date(guess - (asLocal - guess));
  };
  return { from: at(y, mo), to: mo === 12 ? at(y + 1, 1) : at(y, mo + 1) };
}

export function monthOf(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(at);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

export type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Who may move a timesheet where. */
export function canMove(from: Status, to: Status, as: "tutor" | "manager"): boolean {
  if (as === "tutor") return (from === "DRAFT" || from === "REJECTED") && to === "SUBMITTED";
  if (from === "SUBMITTED") return to === "APPROVED" || to === "REJECTED";
  if (from === "APPROVED") return to === "DRAFT"; // reopen for a correction
  return false;
}

/** True when two spans overlap (cover: is the tutor free?). */
export function clashes(a: { start: Date; end: Date }, list: Array<{ start: Date; end: Date }>): boolean {
  return list.some((b) => a.start < b.end && b.start < a.end);
}
