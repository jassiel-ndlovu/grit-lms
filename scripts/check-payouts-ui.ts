/**
 * Checks the pure helpers of the payouts and fees screens.
 *
 *   npx tsx scripts/check-payouts-ui.ts
 */

import { PAYOUT_STATUS, accountLabel, cleanAccountNumber, feeChip, payoutErrorMessage } from "../src/features/courses/lib/payouts-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("status labels", [PAYOUT_STATUS.ACTIVE.label, PAYOUT_STATUS.PENDING.label, PAYOUT_STATUS.DISABLED.tone], ["Connected", "Verifying", "danger"]);
check("account label", accountLabel({ bankName: "FNB", accountNumberLast4: "6789" }), "FNB ••6789");
check(
  "account numbers",
  ["62 1234 5678", "62-1234-5678", "12345", "123456789012345678901", "62a12345"].map(cleanAccountNumber),
  ["6212345678", "6212345678", null, null, null],
);
check(
  "unknown account",
  payoutErrorMessage("NOT_FOUND: The bank doesn't recognise that account number"),
  "Paystack couldn't find that account. Check the bank and number.",
);
check("provider detail kept", payoutErrorMessage("PROVIDER_ERROR: Paystack is down"), "Paystack is down");
check("A's rule kept", payoutErrorMessage("FORBIDDEN: Connect a payout account first"), "Connect a payout account first");
check("no code", payoutErrorMessage("You don't have access to do that."), "You don't have access to do that.");
check("billing off", payoutErrorMessage("BILLING_DISABLED: off"), "Payments aren't switched on yet.");

check(
  "fee chips",
  [
    feeChip("OPEN", null, "2026-12-05", "2026-12-01").label,
    feeChip("OPEN", null, "2026-12-05", "2026-12-05").label,
    feeChip("OPEN", null, "2026-12-05", "2026-12-06"),
    feeChip("PAID", "OFFSITE", "x", "y").label,
    feeChip("PAID", "ONLINE", "x", "y").label,
    feeChip("VOID", null, "x", "y").label,
  ],
  ["Open", "Open", { label: "Overdue", tone: "danger" }, "Paid off-site", "Paid online", "Cancelled"],
);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
