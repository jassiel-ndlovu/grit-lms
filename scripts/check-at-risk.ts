/**
 * Checks the pure parts of the at-risk alert screens
 * (src/features/activity/lib/at-risk.ts): routes, wording and order.
 * The rules themselves: check-risk-rules.ts (A).
 *
 *   npx tsx scripts/check-at-risk.ts
 */

import {
  alertCourses, atRiskRoutes, nobodyToShareWith, parseAlertView, reasonRules, sharedToast, sharedWithLabel, sortAlerts, totalAlerts,
} from "../src/features/activity/lib/at-risk";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("open list", atRiskRoutes.view("open"), "/dashboard/at-risk");
check("open, one course", atRiskRoutes.view("open", "c1"), "/dashboard/at-risk?course=c1");
check("closed, one course", atRiskRoutes.view("closed", "c1"), "/dashboard/at-risk?status=closed&course=c1");
check("a course id is encoded", atRiskRoutes.view("open", "a&b=c"), "/dashboard/at-risk?course=a%26b%3Dc");
check("status: closed", parseAlertView("closed"), "closed");
check("status: anything else is open", [parseAlertView(undefined), parseAlertView("x"), parseAlertView(["closed"])], ["open", "open", "open"]);

check(
  "each reason once, unknown ones left out",
  reasonRules([
    { rule: "LOW_MARKS", average: 40, count: 3 },
    { rule: "ABSENCES", absent: 2, sessions: 5 },
    { rule: "LOW_MARKS", average: 41, count: 3 },
    { rule: "NEW_RULE" } as never,
  ]),
  ["LOW_MARKS", "ABSENCES"],
);

check("shared with both", sharedWithLabel(["STUDENT", "GUARDIANS"]), "the parents and the student");
check("shared with parents", sharedWithLabel(["GUARDIANS"]), "the parents");
check("never shared", sharedWithLabel([]), null);
check("nobody to share with", nobodyToShareWith({ guardians: 0, student: false }) !== null, true);
check("a parent is enough", nobodyToShareWith({ guardians: 1, student: false }), null);
check("an adult student is enough", nobodyToShareWith({ guardians: 0, student: true }), null);

check("toast: one person", sharedToast({ sentTo: 1, emailed: 1 }), "Shared with 1 person.");
check("toast: one has email off", sharedToast({ sentTo: 2, emailed: 1 }), "Shared with 2 people. One has email off and will see it in Nexa.");
check("toast: two have email off", sharedToast({ sentTo: 2, emailed: 0 }), "Shared with 2 people. 2 have email off and will see it in Nexa.");

const rows = [
  { id: "a", closedAt: new Date("2026-11-01") },
  { id: "b", closedAt: new Date("2026-11-20") },
];
check("open keeps A's order", sortAlerts(rows, "open").map((r) => r.id), ["a", "b"]);
check("closed: last closed first", sortAlerts(rows, "closed").map((r) => r.id), ["b", "a"]);
check("sorting leaves the list alone", rows.map((r) => r.id), ["a", "b"]);

const maths = { id: "m", name: "Maths" };
const art = { id: "x", name: "Art" };
check(
  "courses by name, with counts",
  alertCourses([{ course: maths }, { course: art }, { course: maths }]),
  [{ ...art, count: 1 }, { ...maths, count: 2 }],
);
check("total", [totalAlerts({ m: 2, x: 1 }), totalAlerts({})], [3, 0]);

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
