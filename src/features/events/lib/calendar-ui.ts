/**
 * Pure helpers for the calendar and attendance screens (#149). No React, no
 * database: checked by scripts/check-calendar-ui.ts.
 *
 * Days are "day keys" (`YYYY-MM-DD`) in the viewer's time zone, so the
 * server and the browser bucket an occurrence onto the same day whatever
 * zone each runs in. Instants stay ISO strings, as A's
 * `listCalendarOccurrences` returns them.
 */

import type { MeetingProvider } from "@/lib/viewer-core";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

export const CALENDAR_VIEWS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

/** How many days the agenda shows from its anchor. */
export const AGENDA_DAYS = 30;

export function parseView(v: string | undefined | null): CalendarViewMode {
  return v === "week" || v === "day" || v === "agenda" ? v : v === "list" ? "agenda" : "month";
}

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A valid `YYYY-MM-DD`, or `fallback`. */
export function parseDayKey(v: string | undefined | null, fallback: string): string {
  const m = v ? KEY_RE.exec(v) : null;
  if (!m) return fallback;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return toKey(d) === v ? v! : fallback;
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

/** 0 = Sunday .. 6 = Saturday, like `CourseEvent.repeatWeekdays`. */
export function weekdayOf(key: string): number {
  return fromKey(key).getUTCDay();
}

/** Weeks start on Monday (South African calendars). */
export function startOfWeek(key: string): string {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** The first of the month `n` months away. */
export function addMonths(key: string, n: number): string {
  const d = fromKey(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toKey(d);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function parts(instant: Date, timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    partsCache.set(timeZone, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(instant)) if (x.type !== "literal") p[x.type] = x.value;
  return p;
}

/** The day an instant falls on in `timeZone`. */
export function dayKeyOf(instant: Date | string, timeZone: string): string {
  const p = parts(new Date(instant), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The wall date and time (`HH:MM`) of an instant in `timeZone`, for a form. */
export function splitInZone(instant: Date | string, timeZone: string): { date: string; time: string } {
  const p = parts(new Date(instant), timeZone);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * The instant at which `timeZone` shows `day` at `time` (`HH:MM` or
 * `HH:MM:SS`). Two passes settle the offset.
 */
export function wallToInstant(day: string, time: string, timeZone: string): Date {
  const [h, mi, s] = time.split(":").map(Number);
  const [y, mo, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  const offsetAt = (t: number) => {
    const p = parts(new Date(t), timeZone);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}

/** The days a view shows, first to last. Month is a 6-week grid from Monday. */
export function daysFor(view: CalendarViewMode, anchor: string): string[] {
  const start = view === "month" ? startOfWeek(startOfMonth(anchor)) : view === "week" ? startOfWeek(anchor) : anchor;
  const n = view === "month" ? 42 : view === "week" ? 7 : view === "day" ? 1 : AGENDA_DAYS;
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** The instants to ask `listCalendarOccurrences` for (at most 42 days, well under its 120). */
export function rangeFor(view: CalendarViewMode, anchor: string, timeZone: string): { from: string; to: string } {
  const days = daysFor(view, anchor);
  return {
    from: wallToInstant(days[0], "00:00", timeZone).toISOString(),
    to: wallToInstant(addDays(days[days.length - 1], 1), "00:00", timeZone).toISOString(),
  };
}

/** The anchor one step back (-1) or forward (+1). */
export function stepAnchor(view: CalendarViewMode, anchor: string, dir: -1 | 1): string {
  if (view === "month") return addMonths(anchor, dir);
  return addDays(anchor, dir * (view === "week" ? 7 : view === "day" ? 1 : AGENDA_DAYS));
}

/** The heading for a view: "November 2026", "16 – 22 Nov 2026", "Sunday 22 November". */
export function rangeLabel(view: CalendarViewMode, anchor: string, locale: string): string {
  const at = (key: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(fromKey(key));
  if (view === "month") return at(anchor, { month: "long", year: "numeric" });
  if (view === "day") return at(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const days = daysFor(view, anchor);
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `${at(first, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${at(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** A day key's label in a list: "Mon 23 Nov". */
export function dayLabel(key: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(fromKey(key));
}

/* ------------------------------------------------------------------------- */
/* Entries                                                                    */
/* ------------------------------------------------------------------------- */

/** One row on the calendar: an event occurrence, or a test or assignment due. */
export type CalendarEntry = {
  /** Unique on the page: `eventId#occurrenceStart`, or the test or assignment id. */
  id: string;
  kind: "event" | "test" | "assignment";
  /** Events only. */
  eventId: string | null;
  /** Events only: the original start, the key for edits, attendance and check-in. */
  occurrenceStart: string | null;
  start: string;
  end: string | null;
  title: string;
  description: string | null;
  /** CourseEvent.type for events. */
  type: string | null;
  location: string | null;
  link: string | null;
  cancelled: boolean;
  changed: boolean;
  recurring: boolean;
  courseId: string;
  courseName: string;
  /** Where "Open" goes, for tests and assignments. */
  href: string | null;
};

/** Entries bucketed by day key, each day sorted by start. */
export function groupByDay(entries: CalendarEntry[], timeZone: string): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>();
  for (const e of [...entries].sort((a, b) => a.start.localeCompare(b.start))) {
    const k = dayKeyOf(e.start, timeZone);
    const list = out.get(k);
    if (list) list.push(e);
    else out.set(k, [e]);
  }
  return out;
}

/** Minutes between start and end, or null. */
export function durationMinutes(e: Pick<CalendarEntry, "start" | "end">): number | null {
  if (!e.end) return null;
  const m = Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60000);
  return m > 0 ? m : null;
}

/** The Join button is live from 15 minutes before the start until the end (or an hour after). */
export function joinOpen(e: Pick<CalendarEntry, "start" | "end" | "cancelled">, now: Date): boolean {
  if (e.cancelled) return false;
  const start = Date.parse(e.start);
  const end = e.end ? Date.parse(e.end) : start + 60 * 60 * 1000;
  return now.getTime() >= start - 15 * 60 * 1000 && now.getTime() <= end;
}

/** The provider a pasted meeting link points at, or null for any other link. */
export function meetingProviderOf(link: string | null | undefined): Exclude<MeetingProvider, "OTHER"> | null {
  if (!link) return null;
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "meet.google.com") return "GOOGLE_MEET";
  if (host === "zoom.us" || host.endsWith(".zoom.us")) return "ZOOM";
  if (host === "teams.microsoft.com" || host === "teams.live.com") return "TEAMS";
  return null;
}

/** That provider's short name, for the Join button's label. */
export function meetingProvider(link: string | null | undefined): string | null {
  const p = meetingProviderOf(link);
  return p === null ? null : p === "TEAMS" ? "Teams" : MEETING_PROVIDER_INFO[p].label;
}

/** Where a tutor starts a new Google Meet (the default provider) to paste back. */
export const NEW_MEET_URL = "https://meet.google.com/new";

/**
 * The workspace's meeting provider (#211, A's Workspace.meetingProvider):
 * the name in Settings, and where the event form's "New … meeting" button
 * starts one to paste back. OTHER has no button.
 */
export const MEETING_PROVIDER_INFO: Record<MeetingProvider, { label: string; newLabel: string | null; newUrl: string | null }> = {
  GOOGLE_MEET: { label: "Google Meet", newLabel: "New Google Meet", newUrl: NEW_MEET_URL },
  ZOOM: { label: "Zoom", newLabel: "New Zoom meeting", newUrl: "https://zoom.us/start/videomeeting" },
  TEAMS: { label: "Microsoft Teams", newLabel: "New Teams meeting", newUrl: "https://teams.microsoft.com/l/meeting/new" },
  OTHER: { label: "Something else", newLabel: null, newUrl: null },
};

/** Event types that take attendance. */
const ATTENDANCE_TYPES = new Set(["LECTURE", "LIVE", "MEETING"]);
export function takesAttendance(e: Pick<CalendarEntry, "kind" | "type" | "cancelled">): boolean {
  return e.kind === "event" && !e.cancelled && ATTENDANCE_TYPES.has(e.type ?? "");
}

/* ------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* ------------------------------------------------------------------------- */

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export const ATTENDANCE_STATUSES: Array<{ value: AttendanceStatus; short: string; label: string }> = [
  { value: "PRESENT", short: "P", label: "Present" },
  { value: "LATE", short: "L", label: "Late" },
  { value: "ABSENT", short: "A", label: "Absent" },
  { value: "EXCUSED", short: "E", label: "Excused" },
];

export function attendanceLabel(s: string | null | undefined): string {
  return ATTENDANCE_STATUSES.find((x) => x.value === s)?.label ?? "Not marked";
}

/** Attended (present or late) out of marked sessions, excused left out. */
export function attendanceRate(rows: Array<{ status: string }>): { attended: number; counted: number; percent: number | null } {
  const counted = rows.filter((r) => r.status !== "EXCUSED").length;
  const attended = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  return { attended, counted, percent: counted ? Math.round((attended / counted) * 100) : null };
}

/** Check-in codes: case and spaces don't matter (contract), so the input tidies them as typed. */
export function tidyCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/* ------------------------------------------------------------------------- */
/* Routes                                                                     */
/* ------------------------------------------------------------------------- */

export const calendarRoutes = {
  home: "/dashboard/calendar",
  view(p: { view: CalendarViewMode; date?: string | null; child?: string | null }): string {
    const q = new URLSearchParams();
    if (p.view !== "month") q.set("view", p.view);
    if (p.date) q.set("date", p.date);
    if (p.child) q.set("child", p.child);
    const s = q.toString();
    return s ? `/dashboard/calendar?${s}` : "/dashboard/calendar";
  },
  attendance(eventId: string, occurrenceStart: string): string {
    return `/dashboard/calendar/attendance/${encodeURIComponent(eventId)}?at=${encodeURIComponent(occurrenceStart)}`;
  },
  ics(eventId: string): string {
    return `/api/calendar/events/${encodeURIComponent(eventId)}/ics`;
  },
};

/** "Add to Google Calendar" for a webcal feed. */
export function googleSubscribeUrl(webcal: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
}
