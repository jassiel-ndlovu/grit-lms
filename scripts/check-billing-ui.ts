/**
 * Checks B's billing display helpers (src/features/courses/lib/billing-ui.ts).
 *
 *   npx tsx scripts/check-billing-ui.ts
 */

import {
  billingErrorMessage,
  canToggle,
  capLabel,
  capTone,
  formatDelta,
  formatRand,
  groupServices,
  needsConfirm,
  type ServiceRow,
} from "../src/features/courses/lib/billing-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("whole rands", formatRand(13900), "R139");
check("grouping", formatRand(166800), "R1 668");
check("cents", formatRand(13950), "R139,50");
check("zero", formatRand(0), "R0");
check("negative", formatRand(-48000), "−R480");
check("delta up", formatDelta(48000), "+R480");
check("delta down", formatDelta(-48000), "−R480");
check("delta none", formatDelta(0), "R0");

check("error code mapped", billingErrorMessage("PAST_DUE: Pay the overdue bill"), "Pay the overdue bill before moving a course to a higher plan.");
check("unknown code", billingErrorMessage("WAT: x"), "Something went wrong. Try again.");
check("no error text", billingErrorMessage(undefined), "Something went wrong. Try again.");

const s = (over: Partial<ServiceRow>): ServiceRow => ({
  key: "k", name: "K", kind: "premium", tierKey: "PLUS", status: "v1", enabled: false, availableNow: true, ...over,
});
const grouped = groupServices([
  s({ key: "tests", name: "Tests", kind: "basic", tierKey: "CORE" }),
  s({ key: "graphing", name: "Graphs", tierKey: "PLUS" }),
  s({ key: "qb", name: "Question bank", tierKey: "PLUS", status: "later", availableNow: false, reason: "LATER" }),
  s({ key: "ai", name: "AI marking", tierKey: "PRO" }),
  s({ key: "auto", name: "Automarker", tierKey: "PRO", status: "parked", availableNow: false, reason: "PARKED" }),
]);
check("included names", grouped.included, ["Tests"]);
check("tiers hide later and parked", grouped.tiers.map((g) => [g.tier, g.items.map((i) => i.key)]), [["PLUS", ["graphing"]], ["PRO", ["ai"]]]);

check("available → toggle", canToggle(s({})), true);
check("read-only, off → can't switch on", canToggle(s({ availableNow: false, reason: "READ_ONLY" })), false);
check("read-only, on → can switch off", canToggle(s({ enabled: true, availableNow: false, reason: "READ_ONLY" })), true);
check("past due, off → can't raise", canToggle(s({ availableNow: false, reason: "PAST_DUE" })), false);
check("basic never toggles", canToggle(s({ kind: "basic" })), false);

check("same tier → apply at once", needsConfirm({ fromTier: "PLUS", toTier: "PLUS" }), false);
check("tier change → confirm", needsConfirm({ fromTier: "PLUS", toTier: "PRO" }), true);

check("cap with limit", capLabel({ meter: "active-students", used: 12, limit: 20 }), { name: "Students", amount: "12 of 20" });
check("cap storage", capLabel({ meter: "storage-gb", used: 3, limit: 5 }), { name: "Storage", amount: "3 GB of 5 GB" });
check("cap rand", capLabel({ meter: "api-pass-through", used: 12000, limit: 50000 }), { name: "Usage above allowances", amount: "R120 of R500" });
check("cap no limit", capLabel({ meter: "ai-marks", used: 7, limit: null }), { name: "AI-marked answers", amount: "7" });
check("cap tones", [capTone(null), capTone(79), capTone(80), capTone(100)], ["neutral", "neutral", "warning", "danger"]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
