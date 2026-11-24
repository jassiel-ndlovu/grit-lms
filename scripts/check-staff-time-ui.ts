/**
 * Check the timesheet and cover screens' pure helpers:
 *   npx tsx scripts/check-staff-time-ui.ts
 */
import { TIMESHEET_LIMITS } from "../src/features/staff/timesheet-math";
import {
  candidateNote, coverable, coverChip, coverEntryId, coverLine, coverRoutes, duration, kindLabel, lastDayOf, monthLabel, parseCoverView, parseDuration,
  parseMonth, parseRate, parseSheetStatus, rateInput, SHEET_STATUSES, sheetChip, splitSuggestions, stepMonth, timesheetRoutes,
} from "../src/features/events/lib/staff-time-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Routes
check("timesheet routes", [timesheetRoutes.mine(), timesheetRoutes.mine("2026-11"), timesheetRoutes.staff(), timesheetRoutes.staff({ month: "2026-10", status: "SUBMITTED" }), timesheetRoutes.member("m 1", "2026-11")], [
  "/dashboard/timesheets/mine", "/dashboard/timesheets/mine?month=2026-11", "/dashboard/timesheets", "/dashboard/timesheets?month=2026-10&status=submitted", "/dashboard/timesheets/m%201?month=2026-11",
]);
check("payroll", [timesheetRoutes.payroll("2026-11"), timesheetRoutes.payroll("2026-11", true)], ["/api/exports/payroll?month=2026-11", "/api/exports/payroll?month=2026-11&detail=1"]);
check("cover routes", [coverRoutes.list("upcoming"), coverRoutes.list("past")], ["/dashboard/cover", "/dashboard/cover?view=past"]);
check("status in the URL", [parseSheetStatus("submitted"), parseSheetStatus("SUBMITTED"), parseSheetStatus(undefined), parseSheetStatus(["draft"])], ["SUBMITTED", null, null, null]);
check("every status reads back", SHEET_STATUSES.map((s) => parseSheetStatus(s.toLowerCase())), SHEET_STATUSES);
check("cover view", [parseCoverView("past"), parseCoverView("x"), parseCoverView(undefined)], ["past", "upcoming", "upcoming"]);

// Months
check("month: a good one, a bad one", [parseMonth("2026-02", "2026-11"), parseMonth("2026-13", "2026-11"), parseMonth("1999-01", "2026-11"), parseMonth(["2026-02"], "2026-11")], ["2026-02", "2026-11", "2026-11", "2026-11"]);
check("month steps over the year", [stepMonth("2026-12", 1), stepMonth("2026-01", -1)], ["2027-01", "2025-12"]);
check("last day", [lastDayOf("2026-11"), lastDayOf("2028-02"), lastDayOf("2026-12")], ["2026-11-30", "2028-02-29", "2026-12-31"]);
check("month label", monthLabel("2026-11", "en-ZA"), "November 2026");

// Time and money
check("duration", [duration(0), duration(45), duration(120), duration(90)], ["0 min", "45 min", "2 h", "1 h 30 min"]);
check("typed time", [parseDuration("1", "30"), parseDuration("", "45"), parseDuration("12", "")], [{ minutes: 90 }, { minutes: 45 }, { minutes: TIMESHEET_LIMITS.maxEntryMinutes }]);
check("typed time: refused", [["", ""], ["12", "1"], ["1", "60"], ["1.5", ""], ["-1", "0"], ["a", ""]].map(([h, m]) => "error" in parseDuration(h, m)), [true, true, true, true, true, true]);
check("rate", [parseRate("250"), parseRate("250,50"), parseRate("R 1 250.00"), parseRate("0"), parseRate("10000")], [{ cents: 25000 }, { cents: 25050 }, { cents: 125000 }, { cents: 0 }, { cents: TIMESHEET_LIMITS.maxHourlyCents }]);
check("rate: refused", ["", "-5", "10000,01", "2,505", "abc", "1.2.3"].map((s) => "error" in parseRate(s)), [true, true, true, true, true, true]);
check("rate round trip", [0, 25000, 25050, 99].map((c) => parseRate(rateInput(c))), [{ cents: 0 }, { cents: 25000 }, { cents: 25050 }, { cents: 99 }]);
check("no rate", rateInput(null), "");

// Suggestions
const at = (s: string, minutes = 60) => ({ startsAt: new Date(s), minutes });
const now = new Date("2026-11-24T10:00:00Z");
const split = splitSuggestions([at("2026-11-23T10:00:00Z"), at("2026-11-24T09:00:00Z"), at("2026-11-24T09:30:00Z"), at("2026-11-25T09:00:00Z")], now);
check("a class counts once it has finished", [split.taught.length, split.later.length], [2, 2]);
check("kinds", ["SESSION", "COVER", "BOOKING", "MANUAL", "NEW"].map(kindLabel), ["Class", "Cover", "Booked lesson", "Other work", "Other work"]);
check("each status has its own chip", new Set(SHEET_STATUSES.map((s) => sheetChip(s).label)).size, SHEET_STATUSES.length);

// Cover
const away = { membershipId: "a", name: "Ayanda Zulu" };
const cover = { membershipId: "b", name: "Bongani Nkosi" };
const before = { endsAt: new Date("2026-11-24T09:00:00Z") };
const after = { endsAt: new Date("2026-11-25T09:00:00Z") };
check("cover chips", [
  coverChip({ status: "OPEN", ...after }, now).label, coverChip({ status: "OPEN", ...before }, now).label, coverChip({ status: "ASSIGNED", ...after }, now).label,
  coverChip({ status: "ASSIGNED", ...before }, now).label, coverChip({ status: "CANCELLED", ...after }, now).label,
], ["Needs cover", "Not covered", "Cover arranged", "Covered", "Cancelled"]);
check("open: to each of them", [coverLine({ status: "OPEN", absent: away, cover: null }, "a"), coverLine({ status: "OPEN", absent: away, cover: null }, "m")], ["You asked for cover", "Ayanda Zulu needs cover"]);
check("arranged: to each of them", ["a", "b", null].map((me) => coverLine({ status: "ASSIGNED", absent: away, cover }, me)), [
  "Bongani Nkosi is covering for you", "You are covering for Ayanda Zulu", "Bongani Nkosi is covering for Ayanda Zulu",
]);
check("called off", coverLine({ status: "CANCELLED", absent: away, cover }, "b"), "You were covering for Ayanda Zulu");
const cls = { kind: "event", type: "LECTURE", cancelled: false, start: "2026-11-24T09:30:00Z", end: "2026-11-24T10:30:00Z", occurrenceStart: "2026-11-24T09:30:00.000Z" };
check("a class that is on now can be covered", coverable(cls, now), true);
check("not over, cancelled, a deadline, or not an event", [
  coverable({ ...cls, end: "2026-11-24T10:00:00Z" }, now), coverable({ ...cls, cancelled: true }, now), coverable({ ...cls, type: "DEADLINE" }, now), coverable({ ...cls, kind: "booking" }, now), coverable({ ...cls, occurrenceStart: null }, now),
], [false, false, false, false, false]);
check("the calendar entry's id", coverEntryId("e1", new Date("2026-11-24T09:30:00Z")), `e1#${cls.occurrenceStart}`);
check("candidates", [candidateNote({ teachesCourse: true, sameSubject: true }), candidateNote({ teachesCourse: false, sameSubject: true }), candidateNote({ teachesCourse: false, sameSubject: false })], ["Teaches this course", "Teaches this subject", null]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
