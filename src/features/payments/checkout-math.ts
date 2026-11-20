/**
 * How one parent checkout splits (design 04, section 5). Pure; checked by
 * scripts/check-payments.ts against the design's worked example.
 *
 *   T  = sum of invoice totals
 *   C  = sum over invoices of round(2% x total)       Nexa's commission, net
 *   F  = round((2.9% x T + 100) x 1.15)                estimated card fee, VAT incl.
 *   SN = ceil(C x T / (T - F))                          Nexa's gross share, so that
 *        after Paystack's proportional fee Nexa still nets C
 *   Payees split T - SN in proportion to their invoice totals (largest
 *   remainder, so the shares add up exactly). Invoices for the same payee
 *   are summed into one split entry.
 */

export type CheckoutConfig = { commissionBps: number; feeBps: number; feeFixedCents: number; feeVatBps: number };

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = { commissionBps: 200, feeBps: 290, feeFixedCents: 100, feeVatBps: 1500 };

export type CheckoutInvoice = { invoiceId: string; payoutAccountId: string; subaccountCode: string; totalCents: number };

export type CheckoutPlan = {
  totalCents: number;
  commissionCents: number;
  estimatedFeeCents: number;
  nexaShareCents: number;
  allocations: Array<{ invoiceId: string; payoutAccountId: string; amountCents: number; shareCents: number; commissionCents: number }>;
  splits: Array<{ subaccountCode: string; shareCents: number }>;
};

/** Splits `amount` in proportion to `weights`, largest remainder first, so the parts add up exactly. */
export function proportional(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const parts = raw.map(Math.floor);
  let left = amount - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i]++;
    left--;
  }
  return parts;
}

export function planCheckout(invoices: CheckoutInvoice[], cfg: CheckoutConfig = DEFAULT_CHECKOUT_CONFIG): CheckoutPlan {
  if (invoices.length === 0) throw new Error("No invoices");
  for (const i of invoices) if (!Number.isSafeInteger(i.totalCents) || i.totalCents <= 0) throw new Error("Invoice totals must be whole cents above zero");
  const T = invoices.reduce((n, i) => n + i.totalCents, 0);
  const commissions = invoices.map((i) => Math.round((i.totalCents * cfg.commissionBps) / 10_000));
  const C = commissions.reduce((a, b) => a + b, 0);
  const F = Math.round(((T * cfg.feeBps) / 10_000 + cfg.feeFixedCents) * (1 + cfg.feeVatBps / 10_000));
  if (F >= T) throw new Error("The card fee would take the whole amount");
  const SN = Math.ceil((C * T) / (T - F));
  const shares = proportional(T - SN, invoices.map((i) => i.totalCents));
  const allocations = invoices.map((i, k) => ({
    invoiceId: i.invoiceId, payoutAccountId: i.payoutAccountId, amountCents: i.totalCents, shareCents: shares[k], commissionCents: commissions[k],
  }));
  const bySub = new Map<string, number>();
  invoices.forEach((i, k) => bySub.set(i.subaccountCode, (bySub.get(i.subaccountCode) ?? 0) + shares[k]));
  return {
    totalCents: T,
    commissionCents: C,
    estimatedFeeCents: F,
    nexaShareCents: SN,
    allocations,
    splits: [...bySub].map(([subaccountCode, shareCents]) => ({ subaccountCode, shareCents })),
  };
}

/** The least a discounted invoice still costs, so a checkout never reaches zero (Paystack can't charge R0). */
export const MIN_INVOICE_AFTER_DISCOUNT_CENTS = 100;

/**
 * A PARENT_INVOICE discount over the eligible invoices in one checkout.
 * PERCENT takes that share of each invoice; FIXED is one amount per
 * checkout, spread in proportion to the invoice totals. Each invoice keeps
 * at least MIN_INVOICE_AFTER_DISCOUNT_CENTS.
 */
export function discountShares(code: { kind: "PERCENT" | "FIXED"; percentBps: number | null; amountCents: number | null }, totals: number[]): number[] {
  const room = totals.map((t) => Math.max(0, t - MIN_INVOICE_AFTER_DISCOUNT_CENTS));
  if (code.kind === "PERCENT") return totals.map((t, i) => Math.min(Math.round((t * (code.percentBps ?? 0)) / 10_000), room[i]));
  const amount = Math.min(code.amountCents ?? 0, room.reduce((a, b) => a + b, 0));
  return proportional(amount, totals).map((d, i) => Math.min(d, room[i]));
}
