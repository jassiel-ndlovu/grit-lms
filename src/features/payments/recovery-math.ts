/**
 * Refund recovery rules (owner decision 2026-11-20). Pure; checked by
 * scripts/check-payments.ts.
 *
 * Paystack takes a refund from Nexa's balance. The payee owes their share
 * of it (what the split sent them for that invoice, in proportion); Nexa
 * bears its own commission. Nexa takes the debt back from the payee's later
 * checkouts, at most half of each payout, starting a week after the notice.
 * With no payout for 60 days the payee is offered an invoice instead.
 */

export const RECOVERY = {
  /** Days between the notice and the first deduction. */
  graceDays: 7,
  /** Most of one payout a deduction may take, in basis points. */
  maxShareBps: 5000,
  /** Days without a deduction before the payee is offered an invoice. */
  invoiceAfterDays: 60,
} as const;

/** What the payee owes for a refund of `refundCents` on an invoice of `amountCents` whose split sent them `shareCents`. */
export function recoveryOwed(refundCents: number, alloc: { amountCents: number; shareCents: number }): number {
  if (alloc.amountCents <= 0) return 0;
  return Math.round((refundCents * alloc.shareCents) / alloc.amountCents);
}

/** Deductions from one payout of `shareCents`, oldest debt first, capped at maxShareBps of the payout. */
export function takeDeductions(
  shareCents: number,
  debts: Array<{ id: string; outstandingCents: number }>,
  maxShareBps: number = RECOVERY.maxShareBps,
): Array<{ id: string; amountCents: number }> {
  let room = Math.floor((shareCents * maxShareBps) / 10_000);
  const out: Array<{ id: string; amountCents: number }> = [];
  for (const d of debts) {
    if (room <= 0) break;
    const take = Math.min(room, d.outstandingCents);
    if (take <= 0) continue;
    out.push({ id: d.id, amountCents: take });
    room -= take;
  }
  return out;
}
