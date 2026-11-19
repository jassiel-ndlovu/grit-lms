/**
 * Checks the pure helpers of the Nexa admin billing screens.
 *
 *   npx tsx scripts/check-admin-billing-ui.ts
 */

import {
  adminErrorMessage,
  noteProblem,
  normaliseCode,
  parsePercentToBps,
  parseRandToCents,
  percentFromBps,
  workspaceActions,
} from "../src/features/courses/lib/admin-billing-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("error detail kept, code dropped", adminErrorMessage("FORBIDDEN: No trial to extend in state ACTIVE"), "No trial to extend in state ACTIVE");
check("error without a code", adminErrorMessage("You don't have access to do that."), "You don't have access to do that.");
check("no error text", adminErrorMessage(undefined), "Something went wrong. Try again.");

check("note too short", noteProblem("  ok "), "Add a note of at least 3 characters: it goes in the audit log.");
check("note fine", noteProblem("Owner asked by phone"), null);
check("note too long", noteProblem("x".repeat(501)), "Keep the note to 500 characters.");

check(
  "rands",
  ["500", "R500", "r 500", "1 234,50", "1 234,50", "1234.50", "1,234.50", "1,234", "0,5", "12.345", "", "0", "-5", "abc", "R"].map(parseRandToCents),
  [50000, 50000, 50000, 123450, 123450, 123450, 123450, 123400, 50, null, null, null, null, null, null],
);

check("trial actions", workspaceActions("TRIAL"), ["extendTrial", "setComp", "creditNote"]);
check("read-only actions", workspaceActions("READ_ONLY"), ["extendTrial", "setComp", "creditNote"]);
check("comped actions", workspaceActions("COMPED"), ["endComp", "creditNote"]);
check("active actions", workspaceActions("ACTIVE"), ["setComp", "creditNote"]);

check("percent label", [percentFromBps(1000), percentFromBps(1250)], ["10%", "12,5%"]);
check("percents", ["10", "12,5", "12.5%", "100", "0", "101", "x"].map(parsePercentToBps), [1000, 1250, 1250, 10000, null, null, null]);
check("codes", [" launch10 ", "ab", "SUMMER-26_X", "no spaces"].map(normaliseCode), ["LAUNCH10", null, "SUMMER-26_X", null]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
