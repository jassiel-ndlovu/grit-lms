/**
 * AI credit top-ups (#216; owner decisions 24 Nov). Pure: scripts/check-ai-topups.ts
 * covers it.
 *
 * - Markup 8–15% on Nexa's AI cost, so about 5% is left after card fees and
 *   exchange-rate swings. Default 12%; AI_CREDIT_MARKUP_BPS sets it, kept
 *   inside 800–1500.
 * - Only healthy-sized packs: no small top-ups that fees would eat.
 * - Bought credits last as long as the AI supplier's own credits. While Nexa
 *   buys from Anthropic that is AI_CREDIT_VALIDITY_DAYS (default 30). On
 *   AWS or an equivalent, set it to 1095 (the CPA's 3 years).
 * - Two kinds of buyer: an organisation (its shared BOUGHT pool) and a
 *   student or parent (STUDENT credits, spent only by that student's study
 *   assistant, never by staff).
 */

import { AI_CREDITS } from "./credits-math";

export type TopupFor = "WORKSPACE" | "STUDENT";

/** Packs in rand cents. Organisation packs are larger; a student's pack is still well above card fees' fixed part. */
export const TOPUP_PACKS: Record<TopupFor, readonly number[]> = {
  WORKSPACE: [50_000, 100_000, 250_000],
  STUDENT: [15_000, 30_000, 60_000],
};

export function markupBps(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_CREDIT_MARKUP_BPS ?? 1200);
  return Number.isFinite(n) ? Math.min(1500, Math.max(800, Math.round(n))) : 1200;
}

export function validityDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_CREDIT_VALIDITY_DAYS ?? 30);
  return Number.isFinite(n) && n >= 30 ? Math.min(1095, Math.round(n)) : 30;
}

/** Credits a pack buys: its price less the markup, in credits (rounded down). */
export function creditsForPack(priceCents: number, bps: number = markupBps()): number {
  return Math.floor(priceCents / (1 + bps / 10_000) / AI_CREDITS.centsPerCredit);
}

export function isPack(forWhom: TopupFor, priceCents: number): boolean {
  return TOPUP_PACKS[forWhom].includes(priceCents);
}

/**
 * How many credits of an expiring purchase are still unspent, spending the
 * oldest credits first: what's left in the pool, less what newer purchases
 * that haven't expired still hold, at most the purchase itself.
 */
export function unspentAtExpiry(input: { poolBalance: number; purchaseCredits: number; newerUnexpiredCredits: number }): number {
  return Math.max(0, Math.min(input.purchaseCredits, input.poolBalance - input.newerUnexpiredCredits));
}

/** A rough guide for the screen: how many study-assistant answers a pack buys (about 40 credits each, provisional). */
export function roughAnswers(credits: number, perAnswer = 40): number {
  return Math.floor(credits / perAnswer);
}
