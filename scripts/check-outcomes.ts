/**
 * Per-tutor outcomes (#216 phase 3): averages, change per student, hand-in
 * and attendance rates, hours, and the months a period covers. Pure.
 *
 *   npx tsx scripts/check-outcomes.ts
 */

import { computeOutcomes, monthsBetween, type OutcomeInput } from "../src/features/staff/outcomes-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const d = (day: number) => new Date(Date.UTC(2026, 9, day));
const base: OutcomeInput = {
  courses: 2, activeStudents: 3,
  marks: [
    { student: "a", at: d(20), percent: 70 }, { student: "a", at: d(2), percent: 50 },
    { student: "b", at: d(3), percent: 80 }, { student: "b", at: d(25), percent: 60 },
    { student: "c", at: d(4), percent: 65 },
  ],
  workExpected: 10, workHandedIn: 8,
  attendance: [{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }, { status: "EXCUSED" }],
  riskOpened: 2, riskResolved: 1, approvedMinutes: 750, bookingsCompleted: 4, bookingsNoShow: 1,
};
const o = computeOutcomes(base);
check("average of all marks", o.averagePercent, 65);
check("change per student by date, averaged", o.averageChange, 0);
check("improving and declining (5 points or more)", [o.studentsImproving, o.studentsDeclining], [1, 1]);
check("hand-in rate", o.completionRate, 80);
check("attendance: late counts as there, excused left out", o.attendanceRate, 66.7);
check("hours from approved minutes", o.hours, 12.5);
check("counts carried through", [o.courses, o.activeStudents, o.marks, o.riskOpened, o.riskResolved, o.bookingsCompleted, o.bookingsNoShow], [2, 3, 5, 2, 1, 4, 1]);

const empty = computeOutcomes({ ...base, marks: [], workExpected: 0, workHandedIn: 0, attendance: [], approvedMinutes: 0 });
check("no data gives nulls, not zeros", [empty.averagePercent, empty.averageChange, empty.completionRate, empty.attendanceRate, empty.hours], [null, null, null, null, 0]);
check("hand-ins never above 100%", computeOutcomes({ ...base, workExpected: 4, workHandedIn: 6 }).completionRate, 100);

check("months a term covers", monthsBetween(new Date("2026-07-14T00:00:00Z"), new Date("2026-09-23T00:00:00Z")), ["2026-07", "2026-08", "2026-09"]);
check("across a year end", monthsBetween(new Date("2026-11-15T00:00:00Z"), new Date("2027-01-02T00:00:00Z")), ["2026-11", "2026-12", "2027-01"]);
check("an end on the 1st doesn't add that month", monthsBetween(new Date("2026-11-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z")), ["2026-11"]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
