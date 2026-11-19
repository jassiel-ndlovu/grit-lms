/**
 * Checks the pure payment rules: settlement decisions, seat rebuilding from
 * enrolment intervals, invoice numbers, return paths and secret sealing.
 *
 *   npx tsx scripts/check-payments.ts
 */

import { randomBytes } from "node:crypto";

import { decryptSecret, encryptSecret } from "../src/features/payments/secrets";
import {
  decideSettlement,
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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
