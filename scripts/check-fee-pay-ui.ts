/**
 * Checks the fee payment helpers (src/features/courses/lib/fee-pay-ui.ts).
 *
 *   npx tsx scripts/check-fee-pay-ui.ts
 */

import {
  canSelect,
  checkoutErrorMessage,
  cleanCode,
  groupByChild,
  returnReference,
  selectedTotal,
} from "../src/features/courses/lib/fee-pay-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check(
  "selectable",
  [
    canSelect({ status: "OPEN", lockedUntil: null }),
    canSelect({ status: "OPEN", lockedUntil: "2026-11-20T12:00:00.000Z" }),
    canSelect({ status: "PAID", lockedUntil: null }),
  ],
  [true, false, false],
);

const items = [
  { id: "a", totalCents: 50000, child: { userId: "c1", name: "Ama" } },
  { id: "b", totalCents: 25050, child: { userId: "c2", name: "Bo" } },
  { id: "c", totalCents: 10000, child: { userId: "c1", name: "Ama" } },
];
check("total of ticked", [selectedTotal(items, new Set(["a", "c"])), selectedTotal(items, new Set())], [60000, 0]);
check("grouped by child, first seen first", groupByChild(items).map((g) => [g.name, g.items.map((i) => i.id)]), [["Ama", ["a", "c"]], ["Bo", ["b"]]]);

check("codes", [cleanCode(" winter10 "), cleanCode("  ")], ["WINTER10", null]);

check(
  "errors",
  [
    checkoutErrorMessage("CODE_EXPIRED: That code has expired"),
    checkoutErrorMessage("CODE_INVALID: That code doesn't apply to these invoices"),
    checkoutErrorMessage("FORBIDDEN: One of these invoices is already being paid; try again in 30 minutes"),
    checkoutErrorMessage("PROVIDER_ERROR: timeout"),
    checkoutErrorMessage("NOT_FOUND: Some invoices were not found"),
    checkoutErrorMessage(undefined),
    checkoutErrorMessage("Not authenticated"),
  ],
  [
    "That code has expired.",
    "That code doesn't apply to these invoices.",
    "One of these invoices is already being paid; try again in 30 minutes.",
    "We couldn't reach the payment service. Nothing was charged. Try again in a minute.",
    "Some of these fees have changed. Refresh the page and try again.",
    "That didn't work. Check your connection and try again.",
    "Not authenticated",
  ],
);

check(
  "return reference",
  [returnReference({ reference: "abc" }), returnReference({ trxref: "xyz" }), returnReference({}), returnReference({ reference: "x".repeat(129) })],
  ["abc", "xyz", null, null],
);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
