/**
 * Checks the helpers behind the calendar and attendance screens (#149):
 * views and their day ranges, day keys and wall times in a zone, the date
 * stepper, labels, the Join window, meeting providers, the attendance rate,
 * check-in code tidying and the routes.
 *
 *   npx tsx scripts/check-calendar-ui.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import {
  addDays, addMonths, attendanceRate, calendarRoutes, dayKeyOf, daysFor, googleSubscribeUrl, groupByDay, joinOpen, meetingProvider, parseDayKey,
  parseView, rangeFor, rangeLabel, splitInZone, startOfWeek, stepAnchor, takesAttendance, tidyCode, wallToInstant, type CalendarEntry,
} from "../src/features/events/lib/calendar-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const JHB = "Africa/Johannesburg";
const LDN = "Europe/London";

// --- Parsing --------------------------------------------------------------------
check("view: default month", parseView(undefined), "month");
check("view: week", parseView("week"), "week");
check("view: old ?view=list is the agenda", parseView("list"), "agenda");
check("view: junk is month", parseView("year"), "month");
check("day key: valid", parseDayKey("2026-11-22", "x"), "2026-11-22");
check("day key: impossible date falls back", parseDayKey("2026-02-30", "x"), "x");
check("day key: junk falls back", parseDayKey("22/11/2026", "x"), "x");

// --- Day arithmetic ------------------------------------------------------------
check("add days across a month", addDays("2026-11-30", 2), "2026-12-02");
check("week starts Monday (Sun 22 Nov → Mon 16 Nov)", startOfWeek("2026-11-22"), "2026-11-16");
check("week of a Monday is itself", startOfWeek("2026-11-23"), "2026-11-23");
check("add months from the 31st lands on the 1st", addMonths("2026-01-31", 1), "2026-02-01");
check("add months across a year", addMonths("2026-12-15", 1), "2027-01-01");

// --- Views ----------------------------------------------------------------------
const month = daysFor("month", "2026-11-22");
check("month: 42 days from the Monday before the 1st", [month.length, month[0], month[41]], [42, "2026-10-26", "2026-12-06"]);
check("week: Mon to Sun", daysFor("week", "2026-11-25"), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
check("day: one day", daysFor("day", "2026-11-25"), ["2026-11-25"]);
check("agenda: 30 days", daysFor("agenda", "2026-11-25").length, 30);
const r = rangeFor("week", "2026-11-25", JHB);
check("range: Johannesburg midnight is 22:00 UTC the day before", r, { from: "2026-11-22T22:00:00.000Z", to: "2026-11-29T22:00:00.000Z" });
const mr = rangeFor("month", "2026-11-01", JHB);
check("range: the month fits under A's 120 days", (Date.parse(mr.to) - Date.parse(mr.from)) / 86400000, 42);
check("step: month back", stepAnchor("month", "2026-11-22", -1), "2026-10-01");
check("step: week on", stepAnchor("week", "2026-11-22", 1), "2026-11-29");
check("step: day back", stepAnchor("day", "2026-11-01", -1), "2026-10-31");
check("step: agenda on 30 days", stepAnchor("agenda", "2026-11-22", 1), "2026-12-22");
check("label: month", rangeLabel("month", "2026-11-22", "en-ZA"), "November 2026");
check("label: week in one month", rangeLabel("week", "2026-11-25", "en-ZA").replace(/\s/g, " "), "23 – 29 Nov 2026");
check("label: week across months", rangeLabel("week", "2026-12-01", "en-ZA").replace(/\s/g, " ").replace(/\b0(\d)/g, "$1"), "30 Nov – 6 Dec 2026");

// --- Zones -----------------------------------------------------------------------
check("day key: 23:30 UTC is the next day in Johannesburg", dayKeyOf("2026-11-22T23:30:00Z", JHB), "2026-11-23");
check("day key: same instant is still the 22nd in London", dayKeyOf("2026-11-22T23:30:00Z", LDN), "2026-11-22");
check("wall time: 16:00 Johannesburg is 14:00 UTC", wallToInstant("2026-11-23", "16:00", JHB).toISOString(), "2026-11-23T14:00:00.000Z");
check("wall time: London summer (BST)", wallToInstant("2026-07-01", "16:00", LDN).toISOString(), "2026-07-01T15:00:00.000Z");
check("wall time: London winter (GMT)", wallToInstant("2026-12-01", "16:00", LDN).toISOString(), "2026-12-01T16:00:00.000Z");
check("wall time: end of day with seconds", wallToInstant("2026-11-30", "23:59:59", JHB).toISOString(), "2026-11-30T21:59:59.000Z");
check("split: back to the form's date and time", splitInZone("2026-11-23T14:00:00.000Z", JHB), { date: "2026-11-23", time: "16:00" });
check("split ↔ wall round trip", splitInZone(wallToInstant("2026-03-29", "01:30", LDN), LDN).date, "2026-03-29");

// --- Entries ---------------------------------------------------------------------
const base: CalendarEntry = {
  id: "e1#2026-11-23T14:00:00.000Z", kind: "event", eventId: "e1", occurrenceStart: "2026-11-23T14:00:00.000Z", start: "2026-11-23T14:00:00.000Z",
  end: "2026-11-23T15:00:00.000Z", title: "Maths", description: null, type: "LIVE", location: null, link: "https://meet.google.com/abc-defg-hij",
  cancelled: false, changed: false, recurring: true, courseId: "c1", courseName: "Grade 11", href: null,
};
const late = { ...base, id: "e2", start: "2026-11-23T22:30:00.000Z", end: null };
const early = { ...base, id: "e3", start: "2026-11-23T06:00:00.000Z" };
const g = groupByDay([late, base, early], JHB);
check("group: by Johannesburg day, sorted by start", [...g.entries()].map(([k, v]) => [k, v.map((e) => e.id)]), [["2026-11-23", ["e3", base.id]], ["2026-11-24", ["e2"]]]);
check("join: closed 20 minutes before", joinOpen(base, new Date("2026-11-23T13:40:00Z")), false);
check("join: open 15 minutes before", joinOpen(base, new Date("2026-11-23T13:45:00Z")), true);
check("join: open during", joinOpen(base, new Date("2026-11-23T14:30:00Z")), true);
check("join: closed after the end", joinOpen(base, new Date("2026-11-23T15:01:00Z")), false);
check("join: no end means an hour", joinOpen({ ...base, end: null }, new Date("2026-11-23T14:59:00Z")), true);
check("join: never for a cancelled session", joinOpen({ ...base, cancelled: true }, new Date("2026-11-23T14:30:00Z")), false);
check("provider: Meet", meetingProvider("https://meet.google.com/abc-defg-hij"), "Google Meet");
check("provider: Zoom subdomain", meetingProvider("https://us02web.zoom.us/j/123"), "Zoom");
check("provider: Teams", meetingProvider("https://teams.microsoft.com/l/meetup-join/x"), "Teams");
check("provider: a look-alike isn't Zoom", meetingProvider("https://zoom.us.evil.example/j/1"), null);
check("provider: junk", meetingProvider("not a url"), null);
check("attendance: live sessions take it", takesAttendance(base), true);
check("attendance: reminders don't", takesAttendance({ ...base, type: "REMINDER" }), false);
check("attendance: not on a cancelled session", takesAttendance({ ...base, cancelled: true }), false);
check("attendance: not a test due", takesAttendance({ ...base, kind: "test" }), false);

// --- Attendance ------------------------------------------------------------------
check(
  "rate: present and late count, excused left out",
  attendanceRate([{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }, { status: "EXCUSED" }]),
  { attended: 2, counted: 3, percent: 67 },
);
check("rate: nothing marked", attendanceRate([]).percent, null);
check("code: case and spaces don't matter", tidyCode(" ab3 k-9x "), "AB3K9X");

// --- Routes ----------------------------------------------------------------------
check("route: month today is the bare page", calendarRoutes.view({ view: "month" }), "/dashboard/calendar");
check("route: day with a child", calendarRoutes.view({ view: "day", date: "2026-11-23", child: "u1" }), "/dashboard/calendar?view=day&date=2026-11-23&child=u1");
check("route: attendance keyed by occurrence", calendarRoutes.attendance("e1", "2026-11-23T14:00:00.000Z"), "/dashboard/calendar/attendance/e1?at=2026-11-23T14%3A00%3A00.000Z");
check("route: per-event ics", calendarRoutes.ics("e1"), "/api/calendar/events/e1/ics");
check("google subscribe encodes the webcal link", googleSubscribeUrl("webcal://x.test/api/calendar/feed/t.ics"), "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fx.test%2Fapi%2Fcalendar%2Ffeed%2Ft.ics");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
