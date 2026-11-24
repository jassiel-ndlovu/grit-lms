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
  if (!serverError) return "That didn't work. Check your connection and try again.";
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

/** What a discount code takes off: "10% off" or "R50 off". */
export function discountLabel(c: { kind: string; percentBps: number | null; amountCents: number | null }, formatRand: (cents: number) => string): string {
  if (c.kind === "PERCENT" && c.percentBps != null) return `${percentFromBps(c.percentBps)} off`;
  if (c.amountCents != null) return `${formatRand(c.amountCents)} off`;
  return "—";
}

/**
 * A discount code's chip, in order: switched off, not started, ended, used
 * up, else live. `now` is an ISO instant.
 */
export function codeStatus(
  c: { active: boolean; startsAt: string; endsAt: string | null; maxRedemptions: number | null; redemptions: number },
  now: string,
): { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; live: boolean } {
  if (!c.active) return { label: "Off", tone: "neutral", live: false };
  if (c.startsAt > now) return { label: "Starts later", tone: "info", live: false };
  if (c.endsAt != null && c.endsAt <= now) return { label: "Ended", tone: "neutral", live: false };
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return { label: "Used up", tone: "warning", live: false };
  return { label: "Live", tone: "success", live: true };
}

/** "2 courses, 14 learners, 31 files; 512 rows in all" for a retention dry run. */
export function retentionSummary(counts: Record<string, number>): string {
  const n = (k: string) => counts[k] ?? 0;
  const plural = (v: number, one: string, many: string) => `${v.toLocaleString("en-ZA").replace(/\u00a0/g, " ")} ${v === 1 ? one : many}`;
  const rows = Object.entries(counts)
    .filter(([k]) => k !== "files")
    .reduce((sum, [, v]) => sum + (Number.isFinite(v) ? v : 0), 0);
  return `${plural(n("courses"), "course", "courses")}, ${plural(n("learners"), "learner", "learners")}, ${plural(n("files"), "file", "files")}; ${plural(rows, "row", "rows")} in all`;
}

/**
 * The refund amount an admin typed, checked against what can still be
 * refunded. Empty means the whole refundable amount.
 */
export function refundAmount(input: string, refundableCents: number): { cents: number } | { error: string } {
  if (input.trim() === "") return { cents: refundableCents };
  const cents = parseRandToCents(input);
  if (cents == null) return { error: "Enter an amount in rand, for example 250 or 99,50." };
  if (cents > refundableCents) return { error: "That's more than can be refunded on this payment." };
  return { cents };
}

/** A usage limit typed by an owner: a whole number from 1 to 10 000 000, else null. */
export function parseLimit(input: string): number | null {
  const s = input.trim().replace(/[\s\u00a0]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 10_000_000 ? n : null;
}
