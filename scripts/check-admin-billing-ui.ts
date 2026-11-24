/**
 * Checks the pure helpers of the Nexa admin billing screens.
 *
 *   npx tsx scripts/check-admin-billing-ui.ts
 */

import { formatRand } from "../src/features/courses/lib/billing-ui";
import {
  adminErrorMessage,
  codeStatus,
  discountLabel,
  parseLimit,
  refundAmount,
  retentionSummary,
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
check("no error text", adminErrorMessage(undefined), "That didn't work. Check your connection and try again.");

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

check(
  "discount labels",
  [
    discountLabel({ kind: "PERCENT", percentBps: 1250, amountCents: null }, formatRand),
    discountLabel({ kind: "AMOUNT", percentBps: null, amountCents: 50000 }, formatRand),
    discountLabel({ kind: "AMOUNT", percentBps: null, amountCents: null }, formatRand),
  ],
  ["12,5% off", `${formatRand(50000)} off`, "—"],
);

const NOW = "2026-11-20T10:00:00.000Z";
const code = { active: true, startsAt: "2026-11-01T00:00:00.000Z", endsAt: null as string | null, maxRedemptions: null as number | null, redemptions: 3 };
check(
  "code status",
  [
    { ...code, active: false },
    { ...code, startsAt: "2026-12-01T00:00:00.000Z" },
    { ...code, endsAt: NOW },
    { ...code, maxRedemptions: 3 },
    code,
  ].map((c) => codeStatus(c, NOW).label),
  ["Off", "Starts later", "Ended", "Used up", "Live"],
);

check(
  "retention summary",
  [retentionSummary({ courses: 2, learners: 14, files: 31, submissions: 28 }), retentionSummary({ courses: 1 })],
  ["2 courses, 14 learners, 31 files; 44 rows in all", "1 course, 0 learners, 0 files; 1 row in all"],
);

check(
  "refund amounts",
  [refundAmount("", 10000), refundAmount("50", 10000), refundAmount("150", 10000), refundAmount("x", 10000)],
  [{ cents: 10000 }, { cents: 5000 }, { error: "That's more than can be refunded on this payment." }, { error: "Enter an amount in rand, for example 250 or 99,50." }],
);

check("limits", ["500", " 1 000 ", "0", "-3", "2.5", "10000001", "10 000 000", ""].map(parseLimit), [500, 1000, null, null, null, null, 10000000, null]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
