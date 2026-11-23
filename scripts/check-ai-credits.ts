/**
 * Checks AI credit arithmetic and the spending order
 * (src/features/ai-credits/credits-math.ts). Pure; runs in CI.
 *
 *   npx tsx scripts/check-ai-credits.ts
 */

import { AI_CREDITS, creditsForCost, includedCreditsFor, pastWarning, planSpend, purchasePriceCents, type Balances } from "../src/features/ai-credits/credits-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("1 credit = R0.01 of cost", AI_CREDITS.centsPerCredit, 1);
check("a mark at $0.0035 and R18.50/$ costs 7 credits", creditsForCost(3500, 18.5), 7);
check("never less than 1 credit", creditsForCost(1, 18.5), 1);
check("included: Pro 500, Plus 150, Core 0 per seat", includedCreditsFor([{ tierKey: "PRO" }, { tierKey: "PRO" }, { tierKey: "PLUS" }, { tierKey: "CORE" }]), 1150);
check("bought price: cost plus 5%", purchasePriceCents(1000), 1050);
check("warning at 80%", [pastWarning(799, 1000), pastWarning(800, 1000), pastWarning(5, 0)], [false, true, false]);

const base: Balances = { included: 100, bought: 50, personal: 30, allowanceLeft: null, personalAllowed: false };
check("included first", planSpend(base, 60), { ok: true, parts: [{ pool: "INCLUDED", credits: 60 }] });
check("then bought", planSpend(base, 120), { ok: true, parts: [{ pool: "INCLUDED", credits: 100 }, { pool: "BOUGHT", credits: 20 }] });
check("organisation empty, personal not allowed: refused", planSpend(base, 200), { ok: false, reason: "EMPTY" });
check("then personal, when allowed", planSpend({ ...base, personalAllowed: true }, 170), { ok: true, parts: [{ pool: "INCLUDED", credits: 100 }, { pool: "BOUGHT", credits: 50 }, { pool: "PERSONAL", credits: 20 }] });
check("allowance limits the organisation's credits", planSpend({ ...base, allowanceLeft: 40 }, 60), { ok: false, reason: "ALLOWANCE" });
check("past the allowance, own credits carry on", planSpend({ ...base, allowanceLeft: 40, personalAllowed: true }, 60), { ok: true, parts: [{ pool: "INCLUDED", credits: 40 }, { pool: "PERSONAL", credits: 20 }] });
check("an allowance used up entirely", planSpend({ ...base, allowanceLeft: -5 }, 1), { ok: false, reason: "ALLOWANCE" });
check("allowance larger than the pools: the pools are the limit", planSpend({ ...base, allowanceLeft: 1000 }, 200), { ok: false, reason: "EMPTY" });

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll AI credit checks passed.");
