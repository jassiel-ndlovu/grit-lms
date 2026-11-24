/**
 * AI credit top-ups (#216; owner decisions 24 Nov): markup bounds, packs,
 * credits per pack, validity, and the unspent part of an expiring purchase.
 * Pure.
 *
 *   npx tsx scripts/check-ai-topups.ts
 */

import { creditsForPack, isPack, markupBps, TOPUP_PACKS, unspentAtExpiry, validityDays } from "../src/features/ai-credits/topup-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("markup defaults to 12%", markupBps({}), 1200);
check("markup kept inside 8–15%", [markupBps({ AI_CREDIT_MARKUP_BPS: "500" }), markupBps({ AI_CREDIT_MARKUP_BPS: "2000" }), markupBps({ AI_CREDIT_MARKUP_BPS: "950" }), markupBps({ AI_CREDIT_MARKUP_BPS: "x" })], [800, 1500, 950, 1200]);
check("validity follows the supplier: 30 days by default, up to the CPA's 3 years", [validityDays({}), validityDays({ AI_CREDIT_VALIDITY_DAYS: "1095" }), validityDays({ AI_CREDIT_VALIDITY_DAYS: "5000" }), validityDays({ AI_CREDIT_VALIDITY_DAYS: "7" })], [30, 1095, 1095, 30]);
check("R500 at 12% buys 44,642 credits (R446.42 of cost)", creditsForPack(50_000, 1200), 44_642);
check("R150 at 12% buys 13,392 credits", creditsForPack(15_000, 1200), 13_392);
check("at 15% a pack buys fewer", creditsForPack(50_000, 1500) < creditsForPack(50_000, 800), true);
check("no small packs: the smallest is R150", Math.min(...TOPUP_PACKS.STUDENT, ...TOPUP_PACKS.WORKSPACE), 15_000);
check("only listed packs", [isPack("WORKSPACE", 100_000), isPack("WORKSPACE", 15_000), isPack("STUDENT", 15_000), isPack("STUDENT", 999)], [true, false, true, false]);

check("nothing spent: the whole purchase expires", unspentAtExpiry({ poolBalance: 1000, purchaseCredits: 1000, newerUnexpiredCredits: 0 }), 1000);
check("partly spent", unspentAtExpiry({ poolBalance: 300, purchaseCredits: 1000, newerUnexpiredCredits: 0 }), 300);
check("newer credits are spent last, so they stay", unspentAtExpiry({ poolBalance: 1300, purchaseCredits: 1000, newerUnexpiredCredits: 500 }), 800);
check("all spent", unspentAtExpiry({ poolBalance: 200, purchaseCredits: 1000, newerUnexpiredCredits: 500 }), 0);
check("never more than the purchase", unspentAtExpiry({ poolBalance: 5000, purchaseCredits: 1000, newerUnexpiredCredits: 0 }), 1000);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
