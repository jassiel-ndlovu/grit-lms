/**
 * Tutor timesheets and cover (#216 phase 3): suggested entries, cover in
 * and out, bookings, pay, month ranges in SA time, status moves, clashes. Pure.
 *
 *   npx tsx scripts/check-timesheets.ts
 */

import { canMove, clashes, monthOf, monthRange, occurrenceKey, payCents, suggestEntries, type OccurrenceIn } from "../src/features/staff/timesheet-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const occ = (id: string, start: string, mins: number, o: Partial<OccurrenceIn> = {}): OccurrenceIn => ({
  eventId: id, occurrenceStart: start, start, end: new Date(new Date(start).getTime() + mins * 60_000).toISOString(), type: "LECTURE", cancelled: false, courseId: "c1", title: `Class ${id}`, ...o,
});

const own = [
  occ("e1", "2026-11-02T13:00:00.000Z", 90),
  occ("e2", "2026-11-09T13:00:00.000Z", 60, { cancelled: true }),
  occ("e3", "2026-11-16T13:00:00.000Z", 60, { type: "SUBMISSION" }),
  occ("e4", "2026-11-23T13:00:00.000Z", 60),
  occ("e5", "2026-11-25T13:00:00.000Z", 0),
];
const away = new Set([occurrenceKey("e4", "2026-11-23T13:00:00.000Z")]);
const coverIn = [occ("x1", "2026-11-20T08:00:00.000Z", 45, { courseId: "c9", title: "Grade 10 Maths" })];
const bookings = [
  { id: "b1", courseId: "c1", startsAt: new Date("2026-11-03T15:00:00Z"), endsAt: new Date("2026-11-03T16:00:00Z"), status: "COMPLETED" },
  { id: "b2", courseId: "c1", startsAt: new Date("2026-11-04T15:00:00Z"), endsAt: new Date("2026-11-04T16:00:00Z"), status: "NO_SHOW" },
  { id: "b3", courseId: "c1", startsAt: new Date("2026-11-05T15:00:00Z"), endsAt: new Date("2026-11-05T16:00:00Z"), status: "CANCELLED" },
  { id: "b4", courseId: "c1", startsAt: new Date("2026-11-06T15:00:00Z"), endsAt: new Date("2026-11-06T16:00:00Z"), status: "BOOKED" },
];
const s = suggestEntries({ own, coveredAway: away, coveredIn: coverIn, bookings });
check("kinds in date order", s.map((e) => `${e.kind}:${e.eventId ?? e.bookingId}`), ["SESSION:e1", "BOOKING:b1", "BOOKING:b2", "COVER:x1", "SESSION:e5"]);
check("minutes from the class length", s.find((e) => e.eventId === "e1")?.minutes, 90);
check("a class with no length counts an hour", s.find((e) => e.eventId === "e5")?.minutes, 60);
check("cancelled classes and non-teaching events left out", s.some((e) => e.eventId === "e2" || e.eventId === "e3"), false);
check("a class someone covered is left out", s.some((e) => e.eventId === "e4"), false);
check("a covered class is labelled", s.find((e) => e.kind === "COVER")?.label, "Cover: Grade 10 Maths");
check("no-shows count; cancelled and future bookings don't", s.filter((e) => e.kind === "BOOKING").map((e) => e.bookingId), ["b1", "b2"]);
check("a class they cover counts as cover, not their own session", suggestEntries({ own: [own[0]], coveredAway: new Set(), coveredIn: [own[0]], bookings: [] }).map((e) => e.kind), ["COVER"]);
check("cover of a class they also teach isn't doubled", suggestEntries({ own: [own[0]], coveredAway: new Set(), coveredIn: [own[0]], bookings: [] }).length, 1);

// Pay.
check("pay for 90 minutes at R250/h", payCents(90, 25000), 37500);
check("pay rounds to the cent", payCents(7, 10000), 1167);
check("no rate, no pay", payCents(120, 0), 0);

// Months in SA time.
const nov = monthRange("2026-11", "Africa/Johannesburg");
check("November starts at SA midnight", [nov.from.toISOString(), nov.to.toISOString()], ["2026-10-31T22:00:00.000Z", "2026-11-30T22:00:00.000Z"]);
check("December rolls into January", monthRange("2026-12", "Africa/Johannesburg").to.toISOString(), "2026-12-31T22:00:00.000Z");
check("a late-night UTC time is the next month in SA", monthOf(new Date("2026-11-30T23:00:00Z"), "Africa/Johannesburg"), "2026-12");
check("bad month refused", (() => { try { monthRange("2026-13", "UTC"); return "ok"; } catch { return "refused"; } })(), "refused");

// Status moves.
check("tutor submits a draft or a rejected sheet", [canMove("DRAFT", "SUBMITTED", "tutor"), canMove("REJECTED", "SUBMITTED", "tutor"), canMove("SUBMITTED", "APPROVED", "tutor")], [true, true, false]);
check("manager approves or rejects a submitted sheet", [canMove("SUBMITTED", "APPROVED", "manager"), canMove("SUBMITTED", "REJECTED", "manager"), canMove("DRAFT", "APPROVED", "manager")], [true, true, false]);
check("manager reopens an approved sheet", canMove("APPROVED", "DRAFT", "manager"), true);

// Clashes (finding cover).
const slot = { start: new Date("2026-11-20T08:00:00Z"), end: new Date("2026-11-20T09:00:00Z") };
check("overlap clashes", clashes(slot, [{ start: new Date("2026-11-20T08:30:00Z"), end: new Date("2026-11-20T09:30:00Z") }]), true);
check("back to back doesn't", clashes(slot, [{ start: new Date("2026-11-20T09:00:00Z"), end: new Date("2026-11-20T10:00:00Z") }]), false);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
