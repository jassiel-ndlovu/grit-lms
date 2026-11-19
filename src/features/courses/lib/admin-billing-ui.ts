/**
 * Helpers for the Nexa admin billing screens (contracts/billing.md section 4).
 * Pure and client-safe. Checked by scripts/check-admin-billing-ui.ts.
 */

import type { BillingState } from "./billing-ui";

/**
 * An admin action's `serverError` in words. A's messages after the code are
 * written for people ("No trial to extend in state ACTIVE"), and admins
 * need the detail, so the message is shown as it is, without the code.
 */
export function adminErrorMessage(serverError: string | null | undefined): string {
  if (!serverError) return "Something went wrong. Try again.";
  const m = /^[A-Z_]+:\s*(.+)$/.exec(serverError.trim());
  return m ? m[1] : serverError;
}

/** The note every admin action takes: 3 to 500 characters once trimmed. Null when fine. */
export function noteProblem(note: string): string | null {
  const n = note.trim().length;
  if (n < 3) return "Add a note of at least 3 characters: it goes in the audit log.";
  if (n > 500) return "Keep the note to 500 characters.";
  return null;
}

/**
 * Rands typed by a person → integer cents. Accepts "500", "R500",
 * "1 234,50", "1234.50" and "1,234.50". Null for anything else or for zero
 * and below.
 */
export function parseRandToCents(input: string): number | null {
  let s = input.trim().replace(/^R\s*/i, "").replace(/[\s ]/g, "");
  if (!s) return null;
  // A comma followed by exactly two digits at the end is a decimal comma;
  // any other comma groups thousands.
  if (/,\d{1,2}$/.test(s) && !s.includes(".")) s = s.replace(/,(?=\d{1,2}$)/, ".");
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export type WorkspaceAction = "extendTrial" | "setComp" | "endComp" | "creditNote";

/**
 * The actions worth offering for a workspace in a state. A decides in the
 * end: extending a READ_ONLY trial works only if it never paid, and the
 * dialog says so.
 */
export function workspaceActions(state: BillingState): WorkspaceAction[] {
  const out: WorkspaceAction[] = [];
  if (state === "TRIAL" || state === "READ_ONLY") out.push("extendTrial");
  out.push(state === "COMPED" ? "endComp" : "setComp");
  out.push("creditNote");
  return out;
}

/** "PERCENT" 1000 bps → "10% off"; "FIXED" 5000 cents → handled by the caller's formatRand. */
export function percentFromBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-ZA", { maximumFractionDigits: 2 })}%`;
}

/** A percent typed by a person ("10", "12,5", "12.5%") → basis points from 1 to 10 000, else null. */
export function parsePercentToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return bps >= 1 && bps <= 10_000 ? bps : null;
}

/** A discount code as A stores it (upper case, 3 to 32 of A–Z, 0–9, - and _); null when it can't be one. */
export function normaliseCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}
