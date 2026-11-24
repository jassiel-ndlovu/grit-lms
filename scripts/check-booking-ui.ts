/**
 * Check the session booking screens' pure helpers:
 *   npx tsx scripts/check-booking-ui.ts
 */
import { validateRules } from "../src/features/booking/booking-math";
import {
  bookingChip, bookingRoutes, byDay, cancelNote, cancelRule, cancelledToast, firstFreeDay, hoursLabel, lastBookableDay, lessonsIn, lessonsLeft, minutesOf, nextRow,
  parseAdjustment, parseBookingView, parsePolicy, rowsFrom, rulesFrom, timeOf, timeOffLabel, timeOffWarning, type HoursRow,
} from "../src/features/events/lib/booking-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const SAST = "Africa/Johannesburg";
const row = (p: Partial<HoursRow> = {}): HoursRow => ({ key: "k", weekday: 1, start: "14:00", end: "17:00", slotMinutes: 60, bufferMinutes: 0, courseId: null, ...p });

// Routes
check("home", bookingRoutes.list("upcoming"), "/dashboard/bookings");
check("past", bookingRoutes.list("past"), "/dashboard/bookings?view=past");
check("view: anything else is upcoming", [parseBookingView("x"), parseBookingView(undefined), parseBookingView(["past"])], ["upcoming", "upcoming", "upcoming"]);
check("week keeps its filter", bookingRoutes.week({ week: "2026-11-23", course: "c1" }), "/dashboard/bookings?week=2026-11-23&course=c1");
check("book drops empty parts", bookingRoutes.book({ course: "c1", student: null, week: "", tutor: undefined }), "/dashboard/bookings/book?course=c1");
check("hours", [bookingRoutes.hours(), bookingRoutes.hours("m1")], ["/dashboard/bookings/hours", "/dashboard/bookings/hours?tutor=m1"]);

// Weekly hours
check("times", [minutesOf("15:30"), minutesOf("24:00"), minutesOf(""), timeOf(930), timeOf(1440)], [930, null, null, "15:30", "00:00"]);
check("rules round-trip", rulesFrom(rowsFrom([{ id: "r1", weekday: 2, startMinute: 540, endMinute: 1440, slotMinutes: 45, bufferMinutes: 15, courseId: "c1" }])), {
  rules: [{ weekday: 2, startMinute: 540, endMinute: 1440, slotMinutes: 45, bufferMinutes: 15, courseId: "c1" }],
});
check("no rules is allowed", rulesFrom([]), { rules: [] });
check("a missing time names its day", rulesFrom([row({ weekday: 3, end: "" })]), { error: "Wednesday: fill in both times." });
check("an overlap names its day", rulesFrom([row(), row({ start: "16:00", end: "18:00" })]), { error: "Monday: two times overlap." });
check("touching times are fine", "rules" in rulesFrom([row(), row({ start: "17:00", end: "18:00" })]), true);
check("end before start names its day", "error" in rulesFrom([row({ end: "13:00" })]), true);
check("lessons that fit", [lessonsIn(row()), lessonsIn(row({ slotMinutes: 45, bufferMinutes: 15 })), lessonsIn(row({ end: "14:30" })), lessonsIn(row({ end: "" }))], [3, 3, 0, 0]);
check("first line: the afternoon", nextRow([], 1, "n"), row({ key: "n" }));
check("second line: an hour after the last", nextRow([row()], 1, "n"), row({ key: "n", start: "18:00", end: "19:00" }));
check("a new line copies the last one's lengths", nextRow([row({ slotMinutes: 45, bufferMinutes: 10, courseId: "c1" })], 2, "n"), row({ key: "n", weekday: 2, slotMinutes: 45, bufferMinutes: 10, courseId: "c1" }));
check("late in the day: starts at 08:00", nextRow([row({ start: "22:00", end: "23:30" })], 1, "n").start, "08:00");
for (const base of [row(), row({ start: "20:00", end: "22:30" })]) {
  const r = rulesFrom([base, nextRow([base], 1, "n")]);
  check(`a new line after ${base.end} can be saved`, "rules" in r && validateRules(r.rules), null);
}

// Lists and slots
const items = ["2026-11-25T22:30:00Z", "2026-11-25T08:00:00Z", "2026-11-24T10:00:00Z"].map((s) => ({ start: new Date(s) }));
check("by day, in the viewer's zone", byDay(items, (i) => i.start, SAST).map((d) => [d.day, d.items.length]), [["2026-11-24", 1], ["2026-11-25", 1], ["2026-11-26", 1]]);
check("next free day", [firstFreeDay(items, "2026-11-25", SAST), firstFreeDay(items, "2026-11-27", SAST)], ["2026-11-25", null]);
check("last bookable day", lastBookableDay("2026-11-24", 30), "2026-12-24");
const now = new Date("2026-11-24T12:00:00Z");
const later = new Date("2026-11-24T13:00:00Z");
check(
  "chips",
  [bookingChip({ status: "BOOKED", endsAt: later }, now).label, bookingChip({ status: "BOOKED", endsAt: now }, now).label, bookingChip({ status: "NO_SHOW", endsAt: now }, now).label, bookingChip({ status: "CANCELLED", endsAt: later }, now).label],
  ["Booked", "Not marked", "No-show", "Cancelled"],
);

// Wording
check("cancel: late, with a credit", /won't go back/.test(cancelNote({ usedCredit: true, cancelReturnsCredit: false }, false)), true);
check("cancel: in time, with a credit", /get the lesson back/.test(cancelNote({ usedCredit: true, cancelReturnsCredit: true }, false)), true);
check("cancel: staff always give it back", /goes back/.test(cancelNote({ usedCredit: true, cancelReturnsCredit: true }, true)), true);
check("cancel: no credit, no pack", [cancelNote({ usedCredit: false, cancelReturnsCredit: false }, false), cancelledToast(false, false)], ["The tutor is emailed.", "Lesson cancelled."]);
check("lessons left", [lessonsLeft(0), lessonsLeft(1), lessonsLeft(2)], ["0 lessons left", "1 lesson left", "2 lessons left"]);
check("hours", [hoursLabel(1), hoursLabel(24), hoursLabel(36), hoursLabel(48)], ["1 hour", "24 hours", "36 hours", "2 days"]);
check("cancel rule", [cancelRule(0), cancelRule(24)], ["Cancel before it starts and you'll get the lesson back.", "Cancel at least 24 hours before and you'll get the lesson back."]);
check("time off warning", [timeOffWarning(0), /^1 lesson is/.test(timeOffWarning(1) ?? ""), /^2 lessons are/.test(timeOffWarning(2) ?? "")], [null, true, true]);
const off = (a: string, b: string) => timeOffLabel({ startsAt: new Date(a), endsAt: new Date(b) }, SAST, "en-GB");
check(
  "time off: one day, many days, part of a day",
  [off("2026-11-30T22:00:00Z", "2026-12-01T22:00:00Z"), off("2026-11-30T22:00:00Z", "2026-12-05T22:00:00Z"), off("2026-12-01T06:00:00Z", "2026-12-01T10:00:00Z")].map((s) => s.replace(/,(?= \d+ )/g, "")),
  ["Tue 1 Dec", "Tue 1 Dec – Sat 5 Dec", "Tue 1 Dec, 08:00–12:00"],
);

// Numbers
check("policy", parsePolicy({ cancelHours: "24", leadHours: " 0 ", horizonDays: "30" }), { policy: { cancelHours: 24, leadHours: 0, horizonDays: 30 } });
check("policy: limits", [{ cancelHours: "169", leadHours: "0", horizonDays: "30" }, { cancelHours: "1", leadHours: "1.5", horizonDays: "30" }, { cancelHours: "1", leadHours: "1", horizonDays: "0" }, { cancelHours: "", leadHours: "1", horizonDays: "1" }].map((f) => "error" in parsePolicy(f)), [true, true, true, true]);
check("adjustment", [parseAdjustment("5", "add"), parseAdjustment("5", "remove"), parseAdjustment("0", "add"), parseAdjustment("101", "add"), parseAdjustment("-2", "add"), parseAdjustment("x", "add")], [5, -5, null, null, null, null]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
