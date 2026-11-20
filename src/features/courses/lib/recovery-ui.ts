/**
 * Words for refund recovery (contracts/billing.md section 3, Draft 1.12):
 * a Nexa admin refunds a fee invoice, Nexa pays it, and the payee's share
 * is taken from their later payouts. Pure, so scripts can check it.
 */

export type RecoveryStatus = "AWAITING_REFUND" | "ACTIVE" | "RECOVERED" | "CANCELLED" | "WAIVED";
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const RECOVERY_STATUSES = ["AWAITING_REFUND", "ACTIVE", "RECOVERED", "WAIVED", "CANCELLED"] as const satisfies readonly RecoveryStatus[];

export const RECOVERY_CHIP: Record<RecoveryStatus, { label: string; tone: Tone }> = {
  AWAITING_REFUND: { label: "Waiting for Paystack", tone: "info" },
  ACTIVE: { label: "Being recovered", tone: "warning" },
  RECOVERED: { label: "Repaid", tone: "success" },
  WAIVED: { label: "Waived", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** Where the payee lands after the pay link: `/dashboard/fees?recovery=<state>`. */
const RETURN: Record<string, { tone: "success" | "info" | "danger"; text: string }> = {
  paid: { tone: "success", text: "Payment received. Nothing more will be taken from your payouts for that refund." },
  pending: { tone: "info", text: "Your payment is being confirmed. It shows here once Paystack confirms it." },
  failed: { tone: "danger", text: "The payment didn't go through and nothing was taken. You can try again below." },
  "nothing-owed": { tone: "info", text: "There's nothing left to pay on that refund." },
  "not-found": { tone: "danger", text: "We couldn't find that refund. The link may belong to another account." },
  unknown: { tone: "danger", text: "We couldn't match that payment to a refund. If money left your account, it shows here once Paystack confirms it." },
  unavailable: { tone: "info", text: "Online payments are switched off for now. Try again later." },
  error: { tone: "danger", text: "Something went wrong starting the payment and nothing was taken. Try again." },
};

/** The message for a `?recovery=` value, or null for none or one we don't know. */
export function recoveryReturn(state: string | undefined | null): { tone: "success" | "info" | "danger"; text: string } | null {
  return state && Object.prototype.hasOwnProperty.call(RETURN, state) ? RETURN[state] : null;
}

/** A `?status=` value for the admin list, or null for all. */
export function parseRecoveryStatus(s: string | undefined): RecoveryStatus | null {
  return (RECOVERY_STATUSES as readonly string[]).includes(s ?? "") ? (s as RecoveryStatus) : null;
}

/** Deductions have begun: there is a start date and it has passed. `now` is an ISO instant. */
export function deductionsStarted(deductFrom: string | null, now: string): boolean {
  return deductFrom != null && deductFrom <= now;
}

/** Recoveries an admin can still act on: hold and settle need ACTIVE; waive also takes AWAITING_REFUND. */
export function recoveryActions(status: RecoveryStatus): Array<"hold" | "settle" | "waive"> {
  if (status === "ACTIVE") return ["hold", "settle", "waive"];
  if (status === "AWAITING_REFUND") return ["waive"];
  return [];
}
