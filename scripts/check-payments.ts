/**
 * Checks the pure payment rules: settlement decisions, seat rebuilding from
 * enrolment intervals, invoice numbers, return paths and secret sealing.
 *
 *   npx tsx scripts/check-payments.ts
 */

import { randomBytes } from "node:crypto";

import { discountShares, planCheckout, proportional } from "../src/features/payments/checkout-math";
import { RECOVERY, recoveryOwed, takeDeductions } from "../src/features/payments/recovery-math";
import { decryptSecret, encryptSecret } from "../src/features/payments/secrets";
import {
  addCalendarMonths,
  decideSettlement,
  dunningStep,
  firstRetryAt,
  nextInvoiceNumber,
  platformPaymentReference,
  safeReturnPath,
  seatsAt,
} from "../src/features/payments/settlement-rules";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}
function throws(name: string, fn: () => unknown) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  check(name, threw, true);
}

// Settlement
check("paid in full: succeeds", decideSettlement(13900, { status: "SUCCEEDED", amountCents: 13900, currency: "ZAR" }), { kind: "SUCCEEDED" });
check("paid less: mismatch", decideSettlement(13900, { status: "SUCCEEDED", amountCents: 100, currency: "ZAR" }).kind, "MISMATCH");
check("paid more: mismatch", decideSettlement(13900, { status: "SUCCEEDED", amountCents: 20000, currency: "ZAR" }).kind, "MISMATCH");
check("other currency: mismatch", decideSettlement(13900, { status: "SUCCEEDED", amountCents: 13900, currency: "NGN" }).kind, "MISMATCH");
check("failed stays failed", decideSettlement(13900, { status: "FAILED", amountCents: 13900, currency: "ZAR" }), { kind: "FAILED" });
check("abandoned", decideSettlement(13900, { status: "ABANDONED", amountCents: 0, currency: "ZAR" }), { kind: "ABANDONED" });
check("still pending", decideSettlement(13900, { status: "PENDING", amountCents: 13900, currency: "ZAR" }), { kind: "PENDING" });

// Seats at an instant
const d = (day: number) => new Date(Date.UTC(2027, 1, day));
const rows = [
  { courseId: "c1", learnerId: "b", startedAt: d(1), endedAt: null },
  { courseId: "c1", learnerId: "a", startedAt: d(1), endedAt: null },
  { courseId: "c1", learnerId: "dropped", startedAt: d(1), endedAt: d(3) },
  { courseId: "c1", learnerId: "later", startedAt: d(10), endedAt: null },
  { courseId: "c1", learnerId: "a", startedAt: d(2), endedAt: null }, // duplicate open row
  { courseId: "c2", learnerId: "ends-at-t", startedAt: d(1), endedAt: d(5) },
];
check("seats at t: open, sorted, distinct; ended and future excluded", Object.fromEntries(seatsAt(rows, d(5))), { c1: ["a", "b"] });
check("seats before a drop include the dropped learner", Object.fromEntries(seatsAt(rows, d(2))), { c1: ["a", "b", "dropped"], c2: ["ends-at-t"] });

// Invoice numbers and references
check("first number of the year", nextInvoiceNumber(2027, null), "NX-2027-000001");
check("next number", nextInvoiceNumber(2027, "NX-2027-000041"), "NX-2027-000042");
check("new year restarts", nextInvoiceNumber(2028, "NX-2027-000041"), "NX-2028-000001");
check("payment reference", platformPaymentReference("inv1", 2), "nx-inv-inv1-2");

// Return paths
check("same-site path ok", safeReturnPath("/dashboard/billing/return"), "/dashboard/billing/return");
check("protocol-relative refused", safeReturnPath("//evil.example"), null);
check("absolute URL refused", safeReturnPath("https://evil.example"), null);
check("backslash refused", safeReturnPath("/\\evil.example"), null);

// Secret sealing
const key = randomBytes(32).toString("base64");
const sealed = encryptSecret("AUTH_abc123", key);
check("round trip", decryptSecret(sealed, key), "AUTH_abc123");
check("ciphertext does not contain the secret", sealed.includes("AUTH_abc123"), false);
check("two seals differ (random IV)", encryptSecret("AUTH_abc123", key) === sealed, false);
throws("wrong key fails", () => decryptSecret(sealed, randomBytes(32).toString("base64")));
throws("tampered ciphertext fails", () => decryptSecret(sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA"), key));
throws("short key refused", () => encryptSecret("x", Buffer.alloc(16).toString("base64")));

// Retention dates
check("2 months after 3 Feb is 3 Apr", addCalendarMonths(new Date(Date.UTC(2027, 1, 3, 9)), 2).toISOString(), "2027-04-03T09:00:00.000Z");
check("31 Dec + 2 months clamps to 29 Feb in a leap year", addCalendarMonths(new Date(Date.UTC(2027, 11, 31)), 2).toISOString(), "2028-02-29T00:00:00.000Z");

// Dunning (day 0 = renewal date)
const due = new Date(Date.UTC(2027, 2, 5));
const at = (days: number) => new Date(due.getTime() + days * 864e5);
check("day 2: nothing", dunningStep("DAY0", due, at(2)).action, "none");
check("day 3: retry, then DAY3 with next try day 7", dunningStep("DAY0", due, at(3)), { action: "retry", stageIfFails: "DAY3", nextAttemptAt: at(7) });
check("day 5 at DAY3: nothing", dunningStep("DAY3", due, at(5)).action, "none");
check("day 7: retry, then DAY7 with next check day 14", dunningStep("DAY3", due, at(7)), { action: "retry", stageIfFails: "DAY7", nextAttemptAt: at(14) });
check("day 13 at DAY7: nothing", dunningStep("DAY7", due, at(13)).action, "none");
check("day 14: lock", dunningStep("DAY7", due, at(14)).action, "lock");
check("late job on day 15 at DAY0 still locks", dunningStep("DAY0", due, at(15)).action, "lock");
check("locked stays locked", dunningStep("LOCKED", due, at(40)).action, "none");
check("first retry is day 3", firstRetryAt(due).toISOString(), at(3).toISOString());

// Parent checkout split: the worked example in design 04, section 5.
const plan = planCheckout([
  { invoiceId: "A", payoutAccountId: "px", subaccountCode: "ACCT_x", totalCents: 143000 },
  { invoiceId: "B", payoutAccountId: "py", subaccountCode: "ACCT_y", totalCents: 120000 },
]);
check("example: T, C, F, Nexa's gross share", [plan.totalCents, plan.commissionCents, plan.estimatedFeeCents, plan.nexaShareCents], [263000, 5260, 8886, 5444]);
check("example: X gets 140040, Y 117516 (design 04 corrected)", plan.splits, [{ subaccountCode: "ACCT_x", shareCents: 140040 }, { subaccountCode: "ACCT_y", shareCents: 117516 }]);
check("shares + Nexa = total", plan.splits.reduce((n, x) => n + x.shareCents, 0) + plan.nexaShareCents, plan.totalCents);
const same = planCheckout([
  { invoiceId: "A", payoutAccountId: "px", subaccountCode: "ACCT_x", totalCents: 50000 },
  { invoiceId: "B", payoutAccountId: "px", subaccountCode: "ACCT_x", totalCents: 70000 },
]);
check("two invoices for one tutor: one split entry", same.splits.length === 1 && same.allocations.length === 2, true);
check("largest remainder adds up exactly", proportional(100, [1, 1, 1]), [34, 33, 33]);
check("Nexa nets its 2% after a proportional fee", Math.round(plan.nexaShareCents * (1 - plan.estimatedFeeCents / plan.totalCents)) >= plan.commissionCents, true);

// Parent-invoice discount codes.
check("discount: 10% of each invoice", discountShares({ kind: "PERCENT", percentBps: 1000, amountCents: null }, [143000, 120000]), [14300, 12000]);
check("discount: R100 fixed spread by total", discountShares({ kind: "FIXED", percentBps: null, amountCents: 10000 }, [30000, 10000]), [7500, 2500]);
check("discount: never below R1 an invoice", discountShares({ kind: "PERCENT", percentBps: 10000, amountCents: null }, [5000]), [4900]);
check("discount: fixed larger than the invoices", discountShares({ kind: "FIXED", percentBps: null, amountCents: 99999 }, [5000, 5000]), [4900, 4900]);

// Refund recovery (owner decision 2026-11-20).
check("recovery: payee owes their share of a full refund", recoveryOwed(10000, { amountCents: 10000, shareCents: 9800 }), 9800);
check("recovery: partial refund in proportion", recoveryOwed(3000, { amountCents: 10000, shareCents: 9800 }), 2940);
check("recovery: grace, cap and invoice timing", [RECOVERY.graceDays, RECOVERY.maxShareBps, RECOVERY.invoiceAfterDays], [7, 5000, 60]);
check("deductions: at most half of one payout, oldest first", takeDeductions(10000, [{ id: "a", outstandingCents: 3000 }, { id: "b", outstandingCents: 9800 }]), [{ id: "a", amountCents: 3000 }, { id: "b", amountCents: 2000 }]);
check("deductions: nothing owed takes nothing", takeDeductions(10000, [{ id: "a", outstandingCents: 0 }]), []);
check("deductions: small debt taken whole", takeDeductions(10000, [{ id: "a", outstandingCents: 150 }]), [{ id: "a", amountCents: 150 }]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
