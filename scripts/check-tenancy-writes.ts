/**
 * Checks the enrolment rule behind setCourseEnrollment
 * (src/features/workspaces/enrollment-plan.ts): append-only intervals, at
 * most one open row per course and learner.
 *
 *   npx tsx scripts/check-tenancy-writes.ts
 */

import { planEnrollmentChanges, type OpenEnrollment } from "../src/features/workspaces/enrollment-plan";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const row = (id: string, learnerId: string, day: number): OpenEnrollment => ({
  id, learnerId, startedAt: new Date(Date.UTC(2026, 10, day)),
});

check("new course: open one row per learner", planEnrollmentChanges([], ["l2", "l1"]), { open: ["l1", "l2"], close: [] });
check("nothing changes when sets match", planEnrollmentChanges([row("e1", "l1", 1), row("e2", "l2", 1)], ["l1", "l2"]), { open: [], close: [] });
check("a removed learner's open row closes", planEnrollmentChanges([row("e1", "l1", 1), row("e2", "l2", 1)], ["l1"]), { open: [], close: ["e2"] });
check("an added learner gets a new row", planEnrollmentChanges([row("e1", "l1", 1)], ["l1", "l3"]), { open: ["l3"], close: [] });
check("empty set closes every open row", planEnrollmentChanges([row("e1", "l1", 1), row("e2", "l2", 1)], []), { open: [], close: ["e1", "e2"] });
check("duplicate open rows: keep the oldest, close the rest", planEnrollmentChanges([row("e9", "l1", 5), row("e1", "l1", 1)], ["l1"]), { open: [], close: ["e9"] });
check("re-enrolling after a drop opens a new row (closed rows are not passed in)", planEnrollmentChanges([], ["l1"]), { open: ["l1"], close: [] });
check("wanted ids may repeat", planEnrollmentChanges([], ["l1", "l1"]), { open: ["l1"], close: [] });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
