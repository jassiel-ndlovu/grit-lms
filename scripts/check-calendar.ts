/**
 * Checks the pure calendar helpers (src/features/calendar/calendar-math.ts).
 *
 *   npx tsx scripts/check-calendar.ts
 */

import { applyExceptions, buildIcs, hashCode, newCheckInCode, toRRule, untilBefore, type SeriesRow } from "../src/features/calendar/calendar-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const t = (s: string) => new Date(s);
const series: SeriesRow = {
  id: "ev1", title: "Maths class", description: "Bring a calculator; chapter 3", type: "LECTURE", date: t("2026-12-01T14:00:00Z"), duration: 60,
  location: "Room 4", link: "https://meet.example.test/abc", timeZone: "Africa/Johannesburg",
  repeatFrequency: "WEEKLY", repeatInterval: 1, repeatWeekdays: [2, 4], repeatUntil: t("2026-12-31T21:59:00Z"), repeatCount: null,
};
const starts = [t("2026-12-01T14:00:00Z"), t("2026-12-03T14:00:00Z"), t("2026-12-08T14:00:00Z")];
const ex = [
  { occurrenceStart: starts[1], cancelled: true, title: null, description: null, start: null, duration: null, location: null, link: null },
  { occurrenceStart: starts[2], cancelled: false, title: "Maths: test prep", description: null, start: t("2026-12-08T15:00:00Z"), duration: 90, location: null, link: null },
];
const occ = applyExceptions(series, starts, ex);
check("plain occurrence keeps the series", [occ[0].title, occ[0].end, occ[0].cancelled, occ[0].changed], ["Maths class", "2026-12-01T15:00:00.000Z", false, false]);
check("cancelled occurrence", [occ[1].cancelled, occ[1].occurrenceStart], [true, "2026-12-03T14:00:00.000Z"]);
check("changed occurrence: new title, time and length, same key", [occ[2].title, occ[2].start, occ[2].end, occ[2].occurrenceStart, occ[2].changed], ["Maths: test prep", "2026-12-08T15:00:00.000Z", "2026-12-08T16:30:00.000Z", "2026-12-08T14:00:00.000Z", true]);
check("this and following ends a minute before", untilBefore(starts[2]).toISOString(), "2026-12-08T13:59:00.000Z");

check("weekly RRULE with days and end", toRRule(series), "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T215900Z");
check("count and interval", toRRule({ ...series, repeatFrequency: "DAILY", repeatInterval: 2, repeatWeekdays: [], repeatUntil: null, repeatCount: 5 }), "RRULE:FREQ=DAILY;INTERVAL=2;COUNT=5");
check("one-off has no RRULE", toRRule({ ...series, repeatFrequency: "NONE" }), null);

const now = t("2026-11-20T10:00:00Z");
const full = buildIcs([{ series, exceptions: ex, courseName: "Grade 10" }], { name: "Nexa", detail: "full", now });
const lines = full.split("\r\n");
check("calendar wrapper and CRLF", [lines[0], full.endsWith("END:VCALENDAR\r\n")], ["BEGIN:VCALENDAR", true]);
check("series has RRULE and EXDATE for the cancellation", [full.includes("RRULE:FREQ=WEEKLY;BYDAY=TU,TH"), full.includes("EXDATE:20261203T140000Z")], [true, true]);
check("override as RECURRENCE-ID with its own time", [full.includes("RECURRENCE-ID:20261208T140000Z"), full.includes("DTSTART:20261208T150000Z"), full.includes("DTEND:20261208T163000Z")], [true, true, true]);
check("full detail: escaped description and link", [full.includes("DESCRIPTION:Bring a calculator\\; chapter 3"), full.includes("URL:https://meet.example.test/abc")], [true, true]);
check("lines folded at 75 octets", lines.every((l) => Buffer.byteLength(l, "utf8") <= 75), true);
const basic = buildIcs([{ series, exceptions: ex, courseName: "Grade 10" }], { name: "Nexa", detail: "basic", now });
check("basic detail (minors, guardians): no description or link", [basic.includes("DESCRIPTION"), basic.includes("meet.example.test"), basic.includes("SUMMARY:Maths class (Grade 10)")], [false, false, true]);

const code = newCheckInCode();
check("code: six readable characters", /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(code), true);
check("code matching ignores case and spaces", hashCode(code.toLowerCase().split("").join(" ")) === hashCode(code), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
