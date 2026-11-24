/**
 * Timesheets and cover for absent tutors: routes, wording and forms
 * (viewer.md Draft 1.24, organisations). Pure; actions and rules are A's
 * (features/staff). Checked by scripts/check-staff-time-ui.ts.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import { TEACHING_TYPES, TIMESHEET_LIMITS } from "@/features/staff/timesheet-math";

import { addMonths } from "./calendar-ui";

export type SheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type CoverStatus = "OPEN" | "ASSIGNED" | "CANCELLED";
export type CoverView = "upcoming" | "past";

const query = (base: string, q: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
};

export const timesheetRoutes = {
  home: "/dashboard/timesheets",
  mine: (month?: string | null) => query("/dashboard/timesheets/mine", { month }),
  staff: (p: { month?: string | null; status?: SheetStatus | null } = {}) =>
    query("/dashboard/timesheets", { month: p.month, status: p.status?.toLowerCase() }),
  member: (membershipId: string, month?: string | null) =>
    query(`/dashboard/timesheets/${encodeURIComponent(membershipId)}`, { month }),
  /** A's CSV of the month's approved timesheets. */
  payroll: (month: string, detail = false) => query("/api/exports/payroll", { month, detail: detail ? "1" : null }),
};

export const coverRoutes = {
  home: "/dashboard/cover",
  list: (view: CoverView) => query("/dashboard/cover", { view: view === "past" ? "past" : null }),
};

/* ------------------------------------------------------------------------- */
/* Months                                                                    */
/* ------------------------------------------------------------------------- */

/** A `YYYY-MM` from the URL, or the fallback. */
export function parseMonth(raw: string | string[] | undefined, fallback: string): string {
  return typeof raw === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : fallback;
}

export const stepMonth = (month: string, n: number) => addMonths(`${month}-01`, n).slice(0, 7);

/** "November 2026". */
export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

/** The last day of a month, as a day key. */
export function lastDayOf(month: string): string {
  const d = new Date(`${stepMonth(month, 1)}-01T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------------- */
/* Timesheets                                                                */
/* ------------------------------------------------------------------------- */

export const SHEET_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"] as const satisfies readonly SheetStatus[];

const SHEET_CHIP: Record<SheetStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Not submitted", tone: "neutral" },
  SUBMITTED: { label: "Waiting for approval", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Sent back", tone: "warning" },
};
export const sheetChip = (status: SheetStatus) => SHEET_CHIP[status];

export function parseSheetStatus(raw: string | string[] | undefined): SheetStatus | null {
  return SHEET_STATUSES.find((s) => s.toLowerCase() === raw) ?? null;
}

const KIND_LABEL: Record<string, string> = { SESSION: "Class", COVER: "Cover", BOOKING: "Booked lesson" };
export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? "Other work";

/** "1 h 30 min", "45 min", "2 h". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hours and minutes typed in a form. */
export function parseDuration(hours: string, minutes: string): { minutes: number } | { error: string } {
  const h = Number(hours.trim() || "0");
  const m = Number(minutes.trim() || "0");
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return { error: "Enter whole hours and minutes." };
  const total = h * 60 + m;
  if (total < 1 || total > TIMESHEET_LIMITS.maxEntryMinutes) return { error: "Enter between 1 minute and 12 hours." };
  return { minutes: total };
}

/** A rate typed in rand ("250", "250,50", "R 1 250.00"), in cents. */
export function parseRate(raw: string): { cents: number } | { error: string } {
  const s = raw.replace(/[\sR]/gi, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return { error: "Enter an amount in rand, like 250 or 250,50." };
  const cents = Math.round(Number(s) * 100);
  if (cents > TIMESHEET_LIMITS.maxHourlyCents) return { error: "Enter R10 000 an hour or less." };
  return { cents };
}

/** A rate for a text box: 25000 is "250", 25050 is "250,50". */
export function rateInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

/** Suggestions that have finished, and those still to come this month. */
export function splitSuggestions<T extends { startsAt: Date; minutes: number }>(list: readonly T[], now: Date): { taught: T[]; later: T[] } {
  const over = (s: T) => s.startsAt.getTime() + s.minutes * 60_000 <= now.getTime();
  return { taught: list.filter(over), later: list.filter((s) => !over(s)) };
}

/* ------------------------------------------------------------------------- */
/* Cover                                                                     */
/* ------------------------------------------------------------------------- */

export function parseCoverView(raw: string | string[] | undefined): CoverView {
  return raw === "past" ? "past" : "upcoming";
}

type Person = { membershipId: string; name: string };

/** A class's cover, as the calendar and the cover page need it. */
export interface CoverInfo {
  id: string;
  status: CoverStatus;
  absent: Person;
  cover: Person | null;
}

export function coverChip(c: { status: CoverStatus; endsAt: Date }, now: Date): { label: string; tone: StatusTone } {
  const over = c.endsAt <= now;
  if (c.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };
  if (c.status === "ASSIGNED") return { label: over ? "Covered" : "Cover arranged", tone: "success" };
  return over ? { label: "Not covered", tone: "neutral" } : { label: "Needs cover", tone: "warning" };
}

/** "You're covering for Ayanda Zulu", "Bongani Nkosi is covering for you", "Ayanda Zulu needs cover". */
export function coverLine(c: Pick<CoverInfo, "status" | "absent" | "cover">, me: string | null): string {
  const away = c.absent.membershipId === me;
  if (c.cover && c.status !== "OPEN") {
    const was = c.status === "CANCELLED";
    if (c.cover.membershipId === me) return `You ${was ? "were" : "are"} covering for ${c.absent.name}`;
    return `${c.cover.name} ${was ? "was" : "is"} covering for ${away ? "you" : c.absent.name}`;
  }
  return away ? "You asked for cover" : `${c.absent.name} needs cover`;
}

type ClassLike = { kind: string; type: string | null; cancelled: boolean; start: string; end: string | null; occurrenceStart: string | null };

/** A class people can ask cover for: a teaching session that isn't over or cancelled. */
export function coverable(e: ClassLike, now: Date): boolean {
  if (e.kind !== "event" || e.cancelled || !e.occurrenceStart) return false;
  if (!(TEACHING_TYPES as readonly string[]).includes(e.type ?? "")) return false;
  return Date.parse(e.end ?? e.start) > now.getTime();
}

/** The calendar entry a cover request is for (`CalendarEntry.id`). */
export const coverEntryId = (eventId: string, occurrenceStart: Date | string) => `${eventId}#${new Date(occurrenceStart).toISOString()}`;

/** Why a free tutor suits; null when it's only that they're free. */
export function candidateNote(c: { teachesCourse: boolean; sameSubject: boolean }): string | null {
  if (c.teachesCourse) return "Teaches this course";
  return c.sameSubject ? "Teaches this subject" : null;
}
