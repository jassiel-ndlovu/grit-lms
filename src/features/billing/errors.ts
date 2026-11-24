/**
 * Billing errors with the stable codes from docs/revamp/contracts/billing.md.
 * safe-action turns them into `serverError: "<CODE>: <message>"`; B maps the
 * code to a message. Client-safe.
 */

export type BillingErrorCode =
  | "TRIAL_CAP_REACHED"
  | "READ_ONLY"
  | "PAST_DUE"
  | "CODE_INVALID"
  | "CODE_EXPIRED"
  | "CODE_USED"
  | "CARD_REQUIRED"
  | "PROVIDER_ERROR"
  | "FORBIDDEN"
  | "BILLING_DISABLED"
  | "NOT_FOUND"
  /** First payment with no enrolled learners: nothing to charge yet. */
  | "NOTHING_TO_BILL";

export class BillingError extends Error {
  constructor(public readonly code: BillingErrorCode, message?: string) {
    super(message ?? code);
    this.name = "BillingError";
  }
}

/** BILLING=1 turns Phase 2 billing on. Off in production until the owner says so. */
export function isBillingEnabled(): boolean {
  return process.env.BILLING === "1";
}

export function assertBillingEnabled(): void {
  if (!isBillingEnabled()) throw new BillingError("BILLING_DISABLED", "Payments aren't switched on yet.");
}
