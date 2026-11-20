/**
 * Checks the refund recovery words and rules (src/features/courses/lib/recovery-ui.ts).
 *
 *   npx tsx scripts/check-recovery-ui.ts
 */

import { deductionsStarted, parseRecoveryStatus, recoveryActions, recoveryReturn } from "../src/features/courses/lib/recovery-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const states = ["paid", "pending", "failed", "nothing-owed", "not-found", "unknown", "unavailable", "error"];
check("every return state has a message", states.map((s) => recoveryReturn(s) != null), states.map(() => true));
check("return tones", states.map((s) => recoveryReturn(s)?.tone), ["success", "info", "danger", "info", "danger", "danger", "info", "danger"]);
check("no or odd state", [recoveryReturn(undefined), recoveryReturn(""), recoveryReturn("toString"), recoveryReturn("PAID")], [null, null, null, null]);

check("status filter", ["ACTIVE", "WAIVED", "active", undefined, "x"].map(parseRecoveryStatus), ["ACTIVE", "WAIVED", null, null, null]);

const NOW = "2026-11-20T10:00:00.000Z";
check(
  "deductions started",
  [deductionsStarted(null, NOW), deductionsStarted("2026-11-27T00:00:00.000Z", NOW), deductionsStarted("2026-11-13T00:00:00.000Z", NOW), deductionsStarted(NOW, NOW)],
  [false, false, true, true],
);

check(
  "admin actions per status",
  (["ACTIVE", "AWAITING_REFUND", "RECOVERED", "WAIVED", "CANCELLED"] as const).map(recoveryActions),
  [["hold", "settle", "waive"], ["waive"], [], [], []],
);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
