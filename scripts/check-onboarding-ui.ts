/**
 * Checks the workspace setup helpers (src/features/courses/lib/onboarding-ui.ts).
 *
 *   npx tsx scripts/check-onboarding-ui.ts
 */

import {
  checklist,
  nextStep,
  parseStep,
  previousStep,
  stepHref,
  timeZoneOptions,
  trialDaysLeft,
  workspaceNameProblem,
} from "../src/features/courses/lib/onboarding-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("steps", ["business", "course", "payouts", "subjects", ""].map(parseStep), ["business", "course", "payouts", null, null]);
check("next", [nextStep("business"), nextStep("course"), nextStep("payouts")], ["course", "payouts", null]);
check("previous", [previousStep("business"), previousStep("payouts")], [null, "course"]);
check("href", stepHref("course"), "/dashboard/onboarding/course");

check(
  "names",
  [workspaceNameProblem(" a "), workspaceNameProblem("Ubuntu Tutors"), workspaceNameProblem("x".repeat(81))],
  ["Add a name of at least 2 characters.", null, "Keep the name to 80 characters."],
);

const NOW = "2026-11-20T10:00:00.000Z";
check(
  "trial days",
  [trialDaysLeft(null, NOW), trialDaysLeft("2026-12-04T10:00:00.000Z", NOW), trialDaysLeft("2026-11-20T11:00:00.000Z", NOW), trialDaysLeft("2026-11-19T00:00:00.000Z", NOW)],
  [null, 14, 1, 0],
);

const zones = timeZoneOptions("Europe/London");
check("zones start with Johannesburg, then the current one, no repeats", [zones[0], zones[1], zones.length === new Set(zones).size], ["Africa/Johannesburg", "Europe/London", true]);

const a = checklist({ named: true, hasCourse: false, payouts: "todo" });
check("checklist", [a.done, a.total, a.items.map((i) => i.key)], [1, 3, ["business", "course", "payouts"]]);
const b = checklist({ named: false, hasCourse: true, payouts: "not-mine" });
check("checklist without payouts", [b.done, b.total, b.items.map((i) => i.key)], [1, 2, ["business", "course"]]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
