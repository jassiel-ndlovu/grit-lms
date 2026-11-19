/**
 * Helpers for the payouts and fees screens (contracts/billing.md section 3,
 * a/ux/04 sections 6 and 7). Pure and client-safe. Checked by
 * scripts/check-payouts-ui.ts.
 */

import type { Tone } from "./billing-ui";

export type PayoutAccountStatus = "PENDING" | "ACTIVE" | "DISABLED";

/** ACTIVE means connected; Paystack still holds the first payout until it has verified the account. */
export const PAYOUT_STATUS: Record<PayoutAccountStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Connected", tone: "success" },
  PENDING: { label: "Verifying", tone: "info" },
  DISABLED: { label: "Disabled", tone: "danger" },
};

/** "FNB ••6789". */
export function accountLabel(a: { bankName: string; accountNumberLast4: string }): string {
  return `${a.bankName} ••${a.accountNumberLast4}`;
}

/** Digits only, as the bank wants them ("62 1234 5678" → "6212345678"); null unless 6 to 20 digits. */
export function cleanAccountNumber(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6,20}$/.test(digits) ? digits : null;
}

/**
 * A payouts or fees action's `serverError` in words. The bank not knowing
 * the account gets the sentence from ux/04 §7; other messages from A and
 * Paystack are shown as they are, without the code.
 */
export function payoutErrorMessage(serverError: string | null | undefined): string {
  if (!serverError) return "Something went wrong. Try again.";
  const m = /^([A-Z_]+):\s*(.+)$/.exec(serverError.trim());
  if (!m) return serverError;
  const [, code, detail] = m;
  if (code === "NOT_FOUND" && /account/i.test(detail)) return "Paystack couldn't find that account. Check the bank and number.";
  if (code === "BILLING_DISABLED") return "Payments aren't switched on yet.";
  return detail;
}
