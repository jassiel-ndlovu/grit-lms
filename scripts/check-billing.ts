/**
 * Checks the pure billing arithmetic against docs/revamp/a/design/03-billing.md:
 * the worked example (24 × R139 = 333 600 cents, then the 457 400 renewal),
 * the 30-day tier hold, periods, AI overage at cost ÷ 0.8, discounts,
 * credits, VAT and previewServiceChange. Also the catalogue against
 * contracts/services.md.
 *
 *   npx tsx scripts/check-billing.ts
 */

import { ADDONS, SEED_TIERS, SERVICES, type TierKey } from "../src/features/billing/catalogue";
import {
  addDays,
  aiOverageCents,
  billedTier,
  buildPeriodInvoice,
  daysLeft,
  derivedTier,
  discountAmount,
  highestTierDuring,
  holdUntilFor,
  periodFromPayment,
  previewServiceChange,
  type Prices,
} from "../src/features/billing/pricing";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const prices: Prices = { CORE: 9900, PLUS: 13900, PRO: 17900 };
const d = (iso: string) => new Date(`${iso}T08:00:00.000Z`);
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

// --- Catalogue --------------------------------------------------------------
check("seed tier prices", SEED_TIERS.map((t) => [t.key, t.priceCents, t.aiMarksPerStudent]),
  [["CORE", 9900, 0], ["PLUS", 13900, 0], ["PRO", 17900, 30]]);
check("parked keys", Object.values(SERVICES).filter((s) => s.status === "parked").map((s) => s.key).sort(),
  ["automarker", "code-plagiarism", "judge-mode"]);
check("Plus v1 keys", Object.values(SERVICES).filter((s) => s.tier === "PLUS" && s.status === "v1").map((s) => s.key).sort(),
  ["calendar-sync", "custom-branding", "graphing", "live-sessions", "math-input"]);
check("12 basic keys", Object.values(SERVICES).filter((s) => s.kind === "basic").length, 12);
check("add-on statuses", Object.values(ADDONS).map((a) => [a.key, a.status]),
  [["day-pass", "later"], ["ai-credits", "retired"], ["extra-storage", "v1"], ["live-room", "later"], ["runner-capacity", "parked"]]);

// --- Tier derivation --------------------------------------------------------
check("no premium keys: CORE", derivedTier(["tests", "gradebook"]), "CORE");
check("graphing: PLUS", derivedTier(["graphing"]), "PLUS");
check("graphing + ai-marking: PRO", derivedTier(["graphing", "ai-marking"]), "PRO");
check("parked automarker never counts", derivedTier(["automarker", "math-input"]), "PLUS");
check("later leaderboards never counts", derivedTier(["leaderboards"]), "CORE");
check("unknown keys ignored", derivedTier(["nope", "ai-credits"]), "CORE");

// --- Hold: Pro on 10 Feb, back to Plus on 12 Feb, billed at Pro until 12 Mar --
const hold = { tierKey: "PRO" as TierKey, raisedAt: d("2027-02-10"), holdUntil: addDays(d("2027-02-10"), 30) };
check("hold ends 12 March", hold.holdUntil.toISOString().slice(0, 10), "2027-03-12");
check("billed Pro on 12 Feb after switching back", billedTier({ derived: "PLUS", holds: [hold], override: null, at: d("2027-02-12") }), "PRO");
check("billed Pro on 5 March renewal", billedTier({ derived: "PLUS", holds: [hold], override: null, at: d("2027-03-05") }), "PRO");
check("billed Plus once the hold expires", billedTier({ derived: "PLUS", holds: [hold], override: null, at: addDays(d("2027-03-12"), 0.01) }), "PLUS");
check("an override wins", billedTier({ derived: "PRO", holds: [hold], override: { tierKey: "CORE", until: null }, at: d("2027-02-12") }), "CORE");
check("an expired override is ignored", billedTier({ derived: "PLUS", holds: [], override: { tierKey: "CORE", until: d("2027-01-01") }, at: d("2027-02-12") }), "PLUS");
check("holdUntilFor shows the hold", holdUntilFor({ billed: "PRO", holds: [hold], at: d("2027-02-12") })?.toISOString().slice(0, 10), "2027-03-12");
check("holdUntilFor null without a hold", holdUntilFor({ billed: "PLUS", holds: [hold], at: d("2027-02-12") }), null);
check("highest tier during period 1 is Pro",
  highestTierDuring({ tierAtStart: "PLUS", holds: [hold], override: null, start: d("2027-02-03"), end: d("2027-03-05") }), "PRO");
check("a hold raised after the period does not count",
  highestTierDuring({ tierAtStart: "PLUS", holds: [{ ...hold, raisedAt: d("2027-03-06") }], override: null, start: d("2027-02-03"), end: d("2027-03-05") }), "PLUS");

// --- Periods ----------------------------------------------------------------
const p1 = periodFromPayment(d("2027-02-03"));
check("paid 3 Feb renews 5 Mar", p1.renewsAt.toISOString().slice(0, 10), "2027-03-05");
check("late payment starts on the payment date", periodFromPayment(d("2027-03-09")).renewsAt.toISOString().slice(0, 10), "2027-04-08");
check("trial days left", daysLeft(d("2027-02-17"), d("2027-02-03")), 14);
check("days left never negative", daysLeft(d("2027-02-01"), d("2027-02-03")), 0);

// --- Worked example: first invoice, 24 × R139 ------------------------------
const g11 = ids("a", 12);
const g12 = ids("b", 12);
const first = buildPeriodInvoice({
  prices,
  advance: [
    { courseId: "g11", title: "Grade 11 Maths", tier: "PLUS", learnerIds: g11 },
    { courseId: "g12", title: "Grade 12 Maths", tier: "PLUS", learnerIds: g12 },
  ],
  aiMarksPerStudent: 30,
  apiMarginBps: 8000,
});
check("first invoice lines", first.lines.map((l) => [l.kind, l.quantity, l.unitPriceCents, l.amountCents]),
  [["ADVANCE", 12, 13900, 166800], ["ADVANCE", 12, 13900, 166800]]);
check("first invoice total 333 600", first.totalCents, 333600);
check("24 ADVANCE seat charges at PLUS", [first.seatCharges.length, first.seatCharges.every((s) => s.kind === "ADVANCE" && s.tierKey === "PLUS")], [24, true]);

const launch20 = { discountCodeId: "dc1", code: "LAUNCH20", kind: "PERCENT" as const, percentBps: 2000, scope: "WORKSPACE_BILL" as const };
const discounted = buildPeriodInvoice({
  prices, advance: [{ courseId: "g11", title: "Grade 11 Maths", tier: "PLUS", learnerIds: g11 }, { courseId: "g12", title: "Grade 12 Maths", tier: "PLUS", learnerIds: g12 }],
  aiMarksPerStudent: 30, apiMarginBps: 8000, discount: launch20,
});
check("LAUNCH20 discount −66 720, total 266 880", [discounted.discountCents, discounted.totalCents], [66720, 266880]);
const vat = buildPeriodInvoice({
  prices, advance: [{ courseId: "g11", title: "Grade 11 Maths", tier: "PLUS", learnerIds: g11 }, { courseId: "g12", title: "Grade 12 Maths", tier: "PLUS", learnerIds: g12 }],
  aiMarksPerStudent: 30, apiMarginBps: 8000, vatRateBps: 1500,
});
check("VAT-registered: 333 600 + 50 040 = 383 640", [vat.vatCents, vat.totalCents], [50040, 383640]);

// --- Worked example: renewal of 5 March -----------------------------------
const g12new = [...g12, "b13"]; // joined 20 Feb
const renewal = buildPeriodInvoice({
  prices,
  advance: [
    { courseId: "g11", title: "Grade 11 Maths", tier: billedTier({ derived: "PLUS", holds: [hold], override: null, at: p1.renewsAt }), learnerIds: g11 },
    { courseId: "g12", title: "Grade 12 Maths", tier: "PLUS", learnerIds: g12new },
  ],
  closing: [
    {
      courseId: "g11", title: "Grade 11 Maths",
      highestTier: highestTierDuring({ tierAtStart: "PLUS", holds: [hold], override: null, start: p1.start, end: p1.end }),
      overlappingLearnerIds: g11,
      charged: g11.map((learnerId) => ({ learnerId, tierKey: "PLUS" as TierKey })),
      aiMarks: { marks: 300, costMilliCents: 300 * 1200 },
    },
    {
      courseId: "g12", title: "Grade 12 Maths", highestTier: "PLUS",
      overlappingLearnerIds: g12new,
      charged: g12.map((learnerId) => ({ learnerId, tierKey: "PLUS" as TierKey })),
    },
  ],
  aiMarksPerStudent: 30,
  apiMarginBps: 8000,
});
check("renewal lines", renewal.lines.map((l) => [l.kind, l.courseId, l.quantity, l.unitPriceCents, l.amountCents]), [
  ["ADVANCE", "g11", 12, 17900, 214800],
  ["ADVANCE", "g12", 13, 13900, 180700],
  ["TIER_UPGRADE", "g11", 12, 4000, 48000],
  ["CATCH_UP", "g12", 1, 13900, 13900],
]);
check("renewal total 457 400", renewal.totalCents, 457400);
check("300 AI marks within the 360 pool: no pass-through", renewal.lines.some((l) => l.kind === "PASS_THROUGH"), false);
check("one catch-up seat charge for the closing period",
  renewal.seatCharges.filter((s) => s.period === "closing").map((s) => [s.learnerId, s.kind, s.tierKey]), [["b13", "CATCH_UP", "PLUS"]]);
check("12 seat charges move up to PRO", [renewal.tierUpgrades.length, renewal.tierUpgrades.every((u) => u.tierKey === "PRO")], [12, true]);

const dupes = buildPeriodInvoice({
  prices, advance: [{ courseId: "c", title: "C", tier: "CORE", learnerIds: ["x", "x", "y"] }],
  closing: [{ courseId: "c", title: "C", highestTier: "CORE", overlappingLearnerIds: ["x", "y", "z", "z"], charged: [{ learnerId: "x", tierKey: "CORE" }] }],
  aiMarksPerStudent: 30, apiMarginBps: 8000,
});
check("duplicates count once; added-and-dropped still counts", dupes.lines.map((l) => [l.kind, l.quantity]), [["ADVANCE", 2], ["CATCH_UP", 2]]);

// --- AI overage --------------------------------------------------------------
check("overage: 100 excess at 1.2c ÷ 0.8 = 150c", aiOverageCents({ excessMarks: 100, totalMarks: 460, totalCostMilliCents: 460 * 1200, apiMarginBps: 8000 }), 150);
check("overage rounds up", aiOverageCents({ excessMarks: 1, totalMarks: 3, totalCostMilliCents: 1000, apiMarginBps: 8000 }), 1);
check("no excess, no charge", aiOverageCents({ excessMarks: 0, totalMarks: 300, totalCostMilliCents: 9999, apiMarginBps: 8000 }), 0);
const over = buildPeriodInvoice({
  prices, advance: [],
  closing: [{ courseId: "g11", title: "Grade 11 Maths", highestTier: "PRO", overlappingLearnerIds: g11,
    charged: g11.map((learnerId) => ({ learnerId, tierKey: "PRO" as TierKey })), aiMarks: { marks: 460, costMilliCents: 460 * 1200 } }],
  aiMarksPerStudent: 30, apiMarginBps: 8000,
});
check("460 marks against a 360 pool bills 150c pass-through", over.lines.map((l) => [l.kind, l.amountCents]), [["PASS_THROUGH", 150]]);

// --- Discounts, credit -------------------------------------------------------
check("fixed discount capped at base", discountAmount(5000, { kind: "FIXED", amountCents: 9000 }), 5000);
check("percent discount rounds", discountAmount(333, { kind: "PERCENT", percentBps: 2000 }), 67);
const tierCode = buildPeriodInvoice({
  prices, advance: [{ courseId: "a", title: "A", tier: "PRO", learnerIds: ["1"] }, { courseId: "b", title: "B", tier: "PLUS", learnerIds: ["2"] }],
  aiMarksPerStudent: 30, apiMarginBps: 8000,
  discount: { discountCodeId: "t", code: "PRO50", kind: "PERCENT", percentBps: 5000, scope: "TIER", scopeTierKey: "PRO" },
});
check("TIER code applies only to Pro lines", tierCode.discountCents, 8950);
const credited = buildPeriodInvoice({
  prices, advance: [{ courseId: "a", title: "A", tier: "CORE", learnerIds: ["1"] }],
  aiMarksPerStudent: 30, apiMarginBps: 8000, creditAvailableCents: 20000,
});
check("credit never goes below zero; the rest stays open", [credited.creditCents, credited.totalCents, credited.creditLeftCents], [9900, 0, 10100]);

// --- previewServiceChange ----------------------------------------------------
const trialPreview = previewServiceChange({
  prices, at: d("2027-01-20"), inTrial: true, enabled: ["graphing"], enable: ["ai-marking"], disable: [],
  holds: [], override: null, seats: 12, period: null,
});
check("trial: no hold, delta on the first payment", [trialPreview.fromTier, trialPreview.toTier, trialPreview.holdUntil, trialPreview.nextRenewalDeltaCents], ["PLUS", "PRO", null, 48000]);

const raise = previewServiceChange({
  prices, at: d("2027-02-10"), inTrial: false, enabled: ["graphing"], enable: ["ai-marking"], disable: [],
  holds: [], override: null, seats: 12,
  period: { start: p1.start, renewsAt: p1.renewsAt, tierAtStart: "PLUS", charged: Array(12).fill("PLUS"), pendingCatchUpSeats: 0 },
});
check("raise to Pro on 10 Feb", [raise.fromTier, raise.toTier, raise.holdUntil?.toISOString().slice(0, 10)], ["PLUS", "PRO", "2027-03-12"]);
check("raise: catch-up 12 × 4 000 = 48 000", raise.catchUpCents, 48000);
check("raise: next renewal +48 000 advance +48 000 catch-up", raise.nextRenewalDeltaCents, 96000);

const lower = previewServiceChange({
  prices, at: d("2027-02-12"), inTrial: false, enabled: ["graphing", "ai-marking"], enable: [], disable: ["ai-marking"],
  holds: [hold], override: null, seats: 12,
  period: { start: p1.start, renewsAt: p1.renewsAt, tierAtStart: "PLUS", charged: Array(12).fill("PLUS"), pendingCatchUpSeats: 0 },
});
check("lowering within the hold changes nothing; still held until 12 March",
  [lower.fromTier, lower.toTier, lower.holdUntil?.toISOString().slice(0, 10), lower.catchUpCents, lower.nextRenewalDeltaCents], ["PRO", "PRO", "2027-03-12", 0, 0]);

const pending = previewServiceChange({
  prices, at: d("2027-02-21"), inTrial: false, enabled: [], enable: ["math-input"], disable: [],
  holds: [], override: null, seats: 13,
  period: { start: p1.start, renewsAt: p1.renewsAt, tierAtStart: "CORE", charged: Array(12).fill("CORE"), pendingCatchUpSeats: 1 },
});
check("raise with a pending catch-up seat: 13 × 4 000", pending.catchUpCents, 52000);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
