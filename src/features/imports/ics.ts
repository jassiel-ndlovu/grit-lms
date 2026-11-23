/**
 * Reads iCalendar (.ics) files for the calendar import (#216, phase 1).
 * Pure: the check script covers it. Handles what Google, Outlook and Apple
 * export: folded lines, escaped text, DTSTART with TZID, UTC ("Z"),
 * floating and all-day (VALUE=DATE) times, DTEND or DURATION, a basic RRULE
 * (FREQ, INTERVAL, BYDAY for weekly, UNTIL, COUNT) and EXDATE. Changed
 * single occurrences (RECURRENCE-ID) are reported, not imported.
 */

export type IcsFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type IcsEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  link: string;
  /** UTC instant of the first occurrence. */
  start: Date;
  durationMinutes: number;
  allDay: boolean;
  /** The zone the times were written in (or the fallback for floating times). */
  timeZone: string;
  repeat: { frequency: IcsFrequency; interval: number; weekdays: number[]; until: Date | null; count: number | null } | null;
  /** RRULE parts we can't keep (BYMONTHDAY, BYSETPOS…), for a warning. */
  repeatDropped: string[];
  excluded: Date[];
};

export type IcsRead = { events: IcsEvent[]; changedOccurrences: number; problems: string[] };

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The UTC instant of a wall-clock time in an IANA zone. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // a second pass settles daylight-saving edges
  return new Date(t);
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM="b:c":value: the first colon outside quotes ends the parameters.
  let quoted = false;
  let i = 0;
  for (; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) break;
  }
  if (i >= line.length) return null;
  const [name, ...rawParams] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

/** A DTSTART/DTEND/EXDATE/UNTIL value. */
function parseTime(value: string, params: Record<string, string>, fallbackZone: string): { at: Date; allDay: boolean; zone: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const allDay = params.VALUE === "DATE" || h === undefined;
  const zone = params.TZID && isZone(params.TZID) ? params.TZID : fallbackZone;
  if (allDay) return { at: zonedToUtc(+y, +mo, +d, 0, 0, 0, zone), allDay: true, zone };
  if (z) return { at: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false, zone: params.TZID && isZone(params.TZID) ? params.TZID : fallbackZone };
  return { at: zonedToUtc(+y, +mo, +d, +h, +mi, +(s ?? 0), zone), allDay: false, zone };
}

function isZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** ISO 8601 durations as iCalendar writes them: P1D, PT1H30M, P1W. */
export function durationMinutes(v: string): number | null {
  const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, w, d, h, mi, s] = m.map((x) => (x === undefined ? 0 : Number(x))) as unknown as number[];
  return w * 7 * 1440 + d * 1440 + h * 60 + mi + Math.round(s / 60);
}

function parseRRule(v: string, fallbackZone: string): { repeat: IcsEvent["repeat"]; dropped: string[] } {
  const parts = Object.fromEntries(v.split(";").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, val]) => [k.toUpperCase(), val]));
  const freq = parts.FREQ as IcsFrequency | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return { repeat: null, dropped: [`FREQ=${parts.FREQ ?? "?"}`] };
  const dropped = Object.keys(parts).filter((k) => !["FREQ", "INTERVAL", "BYDAY", "UNTIL", "COUNT", "WKST"].includes(k));
  let weekdays: number[] = [];
  if (parts.BYDAY) {
    if (freq === "WEEKLY") weekdays = parts.BYDAY.split(",").map((d: string) => DAYS.indexOf(d.slice(-2).toUpperCase())).filter((i: number) => i >= 0);
    else dropped.push("BYDAY");
  }
  const until = parts.UNTIL ? parseTime(parts.UNTIL, {}, fallbackZone)?.at ?? null : null;
  return {
    repeat: { frequency: freq, interval: Math.max(1, Number(parts.INTERVAL) || 1), weekdays: [...new Set(weekdays)].sort(), until, count: parts.COUNT ? Math.max(1, Number(parts.COUNT)) : null },
    dropped,
  };
}

/** Reads every VEVENT. Times without a zone are read in `fallbackZone` (the workspace's). */
export function readIcs(text: string, fallbackZone: string): IcsRead {
  const lines = unfold(text.replace(/^﻿/, ""));
  const problems: string[] = [];
  if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) return { events: [], changedOccurrences: 0, problems: ["That isn't a calendar (.ics) file."] };
  const events: IcsEvent[] = [];
  let changedOccurrences = 0;
  let cur: Prop[] | null = null;
  let depth = 0; // nested blocks inside a VEVENT (VALARM)
  for (const raw of lines) {
    const line = raw.trimEnd();
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") { cur = []; depth = 0; continue; }
    if (cur && upper.startsWith("BEGIN:")) { depth++; continue; }
    if (cur && upper.startsWith("END:") && depth > 0) { depth--; continue; }
    if (cur && upper === "END:VEVENT") {
      const get = (n: string) => cur!.find((p) => p.name === n);
      if (get("RECURRENCE-ID")) { changedOccurrences++; cur = null; continue; }
      const ds = get("DTSTART");
      const start = ds ? parseTime(ds.value, ds.params, fallbackZone) : null;
      if (!start) { problems.push(`"${unescapeText(get("SUMMARY")?.value ?? "An event")}" has no start time it can read.`); cur = null; continue; }
      let minutes = 60;
      const de = get("DTEND");
      const end = de ? parseTime(de.value, de.params, fallbackZone) : null;
      const dur = get("DURATION");
      if (end) minutes = Math.round((end.at.getTime() - start.at.getTime()) / 60000);
      else if (dur) minutes = durationMinutes(dur.value) ?? 60;
      else if (start.allDay) minutes = 1440;
      const rr = get("RRULE");
      const parsedRule = rr ? parseRRule(rr.value, start.zone) : { repeat: null, dropped: [] };
      const excluded = cur
        .filter((p) => p.name === "EXDATE")
        .flatMap((p) => p.value.split(",").map((v) => parseTime(v, p.params, start.zone)?.at).filter((d): d is Date => !!d));
      const url = get("URL")?.value ?? "";
      events.push({
        uid: get("UID")?.value ?? "",
        title: unescapeText(get("SUMMARY")?.value ?? "").trim(),
        description: unescapeText(get("DESCRIPTION")?.value ?? "").trim(),
        location: unescapeText(get("LOCATION")?.value ?? "").trim(),
        link: /^https?:\/\//i.test(url) ? url : "",
        start: start.at,
        durationMinutes: Math.max(1, minutes),
        allDay: start.allDay,
        timeZone: start.zone,
        repeat: parsedRule.repeat,
        repeatDropped: parsedRule.dropped,
        excluded,
      });
      cur = null;
      continue;
    }
    if (cur && depth === 0) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return { events, changedOccurrences, problems };
}

/** One RRULE string back, for showing and editing in the preview. */
export function repeatText(r: IcsEvent["repeat"]): string {
  if (!r) return "";
  const parts = [`FREQ=${r.frequency}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.weekdays.length) parts.push(`BYDAY=${r.weekdays.map((d) => DAYS[d]).join(",")}`);
  if (r.until) parts.push(`UNTIL=${r.until.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  return parts.join(";");
}

export { parseRRule };
