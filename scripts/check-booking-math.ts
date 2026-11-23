/**
 * Session booking arithmetic (#216 phase 2): time-zone conversion, free
 * slots (lead time, horizon, buffers, time off, busy), cancellation refunds,
 * rule validation and credit balances. Pure.
 *
 *   npx tsx scripts/check-booking-math.ts
 */

import { creditBalance, freeSlots, isFreeSlot, refundsCredit, validateRules, zonedParts, zonedTime, type AvailabilityRule } from "../src/features/booking/booking-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const SA = "Africa/Johannesburg";
const iso = (d: Date) => d.toISOString();
const hhmm = (d: Date) => { const p = zonedParts(d, SA); return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`; };

// Time zones.
check("SA 15:00 is 13:00 UTC", iso(zonedTime(2026, 11, 24, 15 * 60, SA)), "2026-11-24T13:00:00.000Z");
check("SA midnight is 22:00 UTC the day before", iso(zonedTime(2026, 11, 24, 0, SA)), "2026-11-23T22:00:00.000Z");
check("London in summer (BST)", iso(zonedTime(2026, 7, 1, 9 * 60, "Europe/London")), "2026-07-01T08:00:00.000Z");
check("London in winter (GMT)", iso(zonedTime(2026, 12, 1, 9 * 60, "Europe/London")), "2026-12-01T09:00:00.000Z");
check("weekday in SA (Tue 24 Nov 2026)", zonedParts(new Date("2026-11-24T10:00:00Z"), SA).weekday, 2);
check("late UTC is the next day in SA", zonedParts(new Date("2026-11-24T23:30:00Z"), SA).weekday, 3);

// Slots. Now: Mon 23 Nov 2026 08:00 SA.
const now = zonedTime(2026, 11, 23, 8 * 60, SA);
const tue: AvailabilityRule = { weekday: 2, startMinute: 14 * 60, endMinute: 17 * 60, slotMinutes: 60, bufferMinutes: 0 };
const base = { now, timeZone: SA, timeOff: [], busy: [], leadHours: 12, horizonDays: 28 };
const week = { from: now, to: new Date(now.getTime() + 7 * 86_400_000) };
const s1 = freeSlots({ ...base, ...week, rules: [tue] });
check("Tuesday 14:00–17:00 gives three hour slots", s1.map((s) => hhmm(s.start)), ["14:00", "15:00", "16:00"]);
check("slots are an hour long", s1.every((s) => s.end.getTime() - s.start.getTime() === 3_600_000), true);
check("buffer of 30 gives 14:00 and 15:30", freeSlots({ ...base, ...week, rules: [{ ...tue, bufferMinutes: 30 }] }).map((s) => hhmm(s.start)), ["14:00", "15:30"]);
check("a slot must fit before the end", freeSlots({ ...base, ...week, rules: [{ ...tue, slotMinutes: 90 }] }).map((s) => hhmm(s.start)), ["14:00", "15:30"]);
const busy = { start: zonedTime(2026, 11, 24, 15 * 60 + 30, SA), end: zonedTime(2026, 11, 24, 16 * 60, SA) };
check("busy 15:30–16:00 removes the 15:00 slot only", freeSlots({ ...base, ...week, rules: [tue], busy: [busy] }).map((s) => hhmm(s.start)), ["14:00", "16:00"]);
check("busy right after a slot with a buffer blocks it", freeSlots({ ...base, ...week, rules: [{ ...tue, endMinute: 16 * 60, bufferMinutes: 15 }], busy: [{ start: zonedTime(2026, 11, 24, 15 * 60 + 5, SA), end: zonedTime(2026, 11, 24, 15 * 60 + 30, SA) }] }).map((s) => hhmm(s.start)), []);
check("busy touching the end doesn't block", freeSlots({ ...base, ...week, rules: [tue], busy: [{ start: zonedTime(2026, 11, 24, 15 * 60, SA), end: zonedTime(2026, 11, 24, 15 * 60, SA) }] }).length, 3);
check("time off for the afternoon removes all", freeSlots({ ...base, ...week, rules: [tue], timeOff: [{ start: zonedTime(2026, 11, 24, 12 * 60, SA), end: zonedTime(2026, 11, 24, 18 * 60, SA) }] }).length, 0);
const monNow = freeSlots({ ...base, ...week, rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 22 * 60, slotMinutes: 60, bufferMinutes: 0 }] });
check("lead time: Monday slots start 12 hours after 08:00", monNow.length ? hhmm(monNow[0].start) : null, "20:00");
check("horizon cuts after 28 days", freeSlots({ ...base, from: now, to: new Date(now.getTime() + 60 * 86_400_000), rules: [tue] }).length, 12);
check("from/to window respected", freeSlots({ ...base, from: zonedTime(2026, 12, 1, 0, SA), to: zonedTime(2026, 12, 2, 0, SA), rules: [tue] }).map((s) => iso(s.start)), [iso(zonedTime(2026, 12, 1, 14 * 60, SA)), iso(zonedTime(2026, 12, 1, 15 * 60, SA)), iso(zonedTime(2026, 12, 1, 16 * 60, SA))]);
check("two rules on one day merge without duplicates", freeSlots({ ...base, ...week, rules: [tue, { ...tue, startMinute: 17 * 60, endMinute: 18 * 60 }] }).map((s) => hhmm(s.start)), ["14:00", "15:00", "16:00", "17:00"]);
check("empty window gives nothing", freeSlots({ ...base, from: now, to: now, rules: [tue] }).length, 0);
check("isFreeSlot matches exactly", [isFreeSlot(s1[0], s1), isFreeSlot({ start: new Date(s1[0].start.getTime() + 60_000), end: s1[0].end }, s1)], [true, false]);

// Cancelling.
const lesson = zonedTime(2026, 11, 24, 15 * 60, SA);
check("cancel 31 hours before returns the credit", refundsCredit(lesson, now, 24), true);
check("cancel 2 hours before doesn't", refundsCredit(lesson, new Date(lesson.getTime() - 2 * 3_600_000), 24), false);
check("exactly 24 hours before does", refundsCredit(lesson, new Date(lesson.getTime() - 24 * 3_600_000), 24), true);
check("0-hour policy always returns before the start", refundsCredit(lesson, new Date(lesson.getTime() - 60_000), 0), true);

// Rules.
check("valid rules", validateRules([tue, { ...tue, weekday: 4 }]), null);
check("overlap on a day", validateRules([tue, { ...tue, startMinute: 16 * 60, endMinute: 18 * 60 }]), "Two times overlap on the same day.");
check("back-to-back is fine", validateRules([tue, { ...tue, startMinute: 17 * 60, endMinute: 18 * 60 }]), null);
check("end before start", validateRules([{ ...tue, endMinute: 13 * 60 }]), "Each time must end after it starts, on the same day.");
check("bad weekday", validateRules([{ ...tue, weekday: 7 }]), "Pick a day of the week.");
check("too short for a lesson", validateRules([{ ...tue, endMinute: 14 * 60 + 30 }]), "Each time must fit at least one lesson.");
check("lesson length limits", validateRules([{ ...tue, slotMinutes: 10 }]), "Lessons must be between 15 minutes and 4 hours.");

// Credits.
check("balance sums the ledger", creditBalance([{ lessons: 10 }, { lessons: -1 }, { lessons: -1 }, { lessons: 1 }]), 9);
check("empty ledger is 0", creditBalance([]), 0);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
