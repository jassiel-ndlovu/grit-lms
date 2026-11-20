/**
 * Pure calendar helpers (A, #149; B research 10). Checked by
 * scripts/check-calendar.ts.
 *
 *   applyExceptions   occurrences of a series with "this one only" changes
 *                     and cancellations applied
 *   untilBefore       the end date for "this and following" (the old series
 *                     stops just before the chosen occurrence)
 *   toRRule           RFC 5545 RRULE from today's recurrence columns
 *   buildIcs          an iCalendar file (series with RRULE, EXDATE for
 *                     cancellations, RECURRENCE-ID overrides)
 *   newCheckInCode    a short code that is easy to read aloud
 */

import { createHash, randomInt } from "node:crypto";

export type SeriesRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  date: Date;
  duration: number | null;
  location: string | null;
  link: string | null;
  timeZone: string;
  repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: Date | null;
  repeatCount: number | null;
};

export type ExceptionRow = {
  occurrenceStart: Date;
  cancelled: boolean;
  title: string | null;
  description: string | null;
  start: Date | null;
  duration: number | null;
  location: string | null;
  link: string | null;
};

export type Occurrence = {
  eventId: string;
  /** The original start: the key for exceptions, attendance and check-in. */
  occurrenceStart: string;
  start: string;
  end: string;
  title: string;
  description: string;
  type: string;
  location: string | null;
  link: string | null;
  cancelled: boolean;
  changed: boolean;
  recurring: boolean;
};

const MIN = 60 * 1000;

export function applyExceptions(e: SeriesRow, starts: Date[], exceptions: ExceptionRow[]): Occurrence[] {
  const byStart = new Map(exceptions.map((x) => [x.occurrenceStart.getTime(), x]));
  return starts.map((s) => {
    const x = byStart.get(s.getTime());
    const start = x?.start ?? s;
    const duration = x?.duration ?? e.duration ?? 60;
    return {
      eventId: e.id,
      occurrenceStart: s.toISOString(),
      start: start.toISOString(),
      end: new Date(start.getTime() + duration * MIN).toISOString(),
      title: x?.title ?? e.title,
      description: x?.description ?? e.description,
      type: e.type,
      location: x?.location ?? e.location,
      link: x?.link ?? e.link,
      cancelled: x?.cancelled ?? false,
      changed: !!x && !x.cancelled,
      recurring: e.repeatFrequency !== "NONE",
    };
  });
}

/** "This and following": the existing series ends one minute before `occurrenceStart`. */
export function untilBefore(occurrenceStart: Date): Date {
  return new Date(occurrenceStart.getTime() - MIN);
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function toRRule(e: Pick<SeriesRow, "repeatFrequency" | "repeatInterval" | "repeatWeekdays" | "repeatUntil" | "repeatCount">): string | null {
  if (e.repeatFrequency === "NONE") return null;
  const parts = [`FREQ=${e.repeatFrequency}`];
  if (e.repeatInterval > 1) parts.push(`INTERVAL=${e.repeatInterval}`);
  if (e.repeatFrequency === "WEEKLY" && e.repeatWeekdays.length) parts.push(`BYDAY=${[...e.repeatWeekdays].sort().map((d) => DAYS[d]).join(",")}`);
  if (e.repeatUntil) parts.push(`UNTIL=${icsDate(e.repeatUntil)}`);
  else if (e.repeatCount) parts.push(`COUNT=${e.repeatCount}`);
  return `RRULE:${parts.join(";")}`;
}

/** RFC 5545 text escaping and 75-octet line folding. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export type IcsEvent = { series: SeriesRow; exceptions: ExceptionRow[]; courseName: string };

/**
 * One VCALENDAR. `detail` "full" includes descriptions and meeting links;
 * "basic" (feeds for minors and their guardians) carries only the title,
 * time, course and location (POPIA, decision taken here).
 */
export function buildIcs(items: IcsEvent[], opts: { name: string; detail: "full" | "basic"; now?: Date }): string {
  const stamp = icsDate(opts.now ?? new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nexa//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(opts.name)}`];
  const body = (title: string, description: string, location: string | null, link: string | null, courseName: string) => {
    const out = [`SUMMARY:${esc(`${title} (${courseName})`)}`];
    if (location) out.push(`LOCATION:${esc(location)}`);
    if (opts.detail === "full") {
      const desc = [description, link ? `Join: ${link}` : ""].filter(Boolean).join("\n\n");
      if (desc) out.push(`DESCRIPTION:${esc(desc)}`);
      if (link) out.push(`URL:${esc(link)}`);
    }
    return out;
  };
  for (const { series: e, exceptions, courseName } of items) {
    const uid = `${e.id}@nexa-lms.co.za`;
    const dur = e.duration ?? 60;
    lines.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(e.date)}`, `DTEND:${icsDate(new Date(e.date.getTime() + dur * MIN))}`);
    const rrule = toRRule(e);
    if (rrule) lines.push(rrule);
    const cancelled = exceptions.filter((x) => x.cancelled).map((x) => icsDate(x.occurrenceStart));
    if (rrule && cancelled.length) lines.push(`EXDATE:${cancelled.join(",")}`);
    lines.push(...body(e.title, e.description, e.location, e.link, courseName), "END:VEVENT");
    if (!rrule) continue;
    for (const x of exceptions.filter((y) => !y.cancelled)) {
      const start = x.start ?? x.occurrenceStart;
      lines.push(
        "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `RECURRENCE-ID:${icsDate(x.occurrenceStart)}`,
        `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(new Date(start.getTime() + (x.duration ?? dur) * MIN))}`,
        ...body(x.title ?? e.title, x.description ?? e.description, x.location ?? e.location, x.link ?? e.link, courseName),
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Six characters without look-alikes (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCheckInCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
export function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
}
