/**
 * Pure rules behind settlePayment (design 04, sections 3 and 6). Checked by
 * scripts/check-payments.ts.
 */

export type VerifiedTransaction = {
  status: "SUCCEEDED" | "FAILED" | "ABANDONED" | "PENDING";
  amountCents: number;
  currency: string;
};

export type SettlementDecision =
  | { kind: "SUCCEEDED" }
  | { kind: "FAILED" | "ABANDONED" }
  | { kind: "PENDING" }
  /** Paystack says paid, but not the amount or currency we asked for. Never applied. */
  | { kind: "MISMATCH"; reason: string };

/** A payment succeeds only when the provider agrees on status, amount and currency. */
export function decideSettlement(expectedCents: number, v: VerifiedTransaction): SettlementDecision {
  if (v.status === "SUCCEEDED") {
    if (v.currency !== "ZAR") return { kind: "MISMATCH", reason: `currency ${v.currency}` };
    if (v.amountCents !== expectedCents) return { kind: "MISMATCH", reason: `amount ${v.amountCents} != ${expectedCents}` };
    return { kind: "SUCCEEDED" };
  }
  if (v.status === "FAILED" || v.status === "ABANDONED") return { kind: v.status };
  return { kind: "PENDING" };
}

export type EnrollmentInterval = { courseId: string; learnerId: string; startedAt: Date; endedAt: Date | null };

/**
 * Learners per course enrolled at instant `t`. Enrolments are append-only
 * intervals, so this rebuilds the seats an invoice counted when it was
 * issued, even after later changes. Sorted, distinct.
 */
export function seatsAt(rows: readonly EnrollmentInterval[], t: Date): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.startedAt.getTime() > t.getTime()) continue;
    if (r.endedAt && r.endedAt.getTime() <= t.getTime()) continue;
    if (!out.has(r.courseId)) out.set(r.courseId, new Set());
    out.get(r.courseId)!.add(r.learnerId);
  }
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** NX-<year>-<6 digits>, the number after `last` (or the first of the year). */
export function nextInvoiceNumber(year: number, last: string | null): string {
  const prefix = `NX-${year}-`;
  const n = last && last.startsWith(prefix) ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(6, "0")}`;
}

/** `nx-inv-<invoiceId>-<attempt>` (design 04, section 4). */
export function platformPaymentReference(invoiceId: string, attempt: number): string {
  return `nx-inv-${invoiceId}-${attempt}`;
}

/** A same-site path to send the payer back to: starts with one "/", no scheme or host. */
export function safeReturnPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(path) || path.length > 512) return null;
  return path;
}

/** Same day-of-month `months` later in UTC, clamped to the month's last day. */
export function addCalendarMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

export type DunningStage = "NONE" | "DAY0" | "DAY3" | "DAY7" | "LOCKED";

export type DunningStep =
  | { action: "none" }
  | { action: "retry"; stageIfFails: DunningStage; nextAttemptAt: Date | null }
  | { action: "lock" };

const DAY = 24 * 60 * 60 * 1000;

/**
 * What the daily job does with an unpaid renewal (design 03, section 7),
 * counted from the renewal date `dueAt` (day 0): retry the card on day 3
 * and day 7, read-only on day 14.
 */
export function dunningStep(stage: DunningStage, dueAt: Date, now: Date): DunningStep {
  const days = (now.getTime() - dueAt.getTime()) / DAY;
  if (stage === "LOCKED" || stage === "NONE") return { action: "none" };
  if (days >= 14) return { action: "lock" };
  if (stage === "DAY0" && days >= 3) return { action: "retry", stageIfFails: "DAY3", nextAttemptAt: new Date(dueAt.getTime() + 7 * DAY) };
  if (stage === "DAY3" && days >= 7) return { action: "retry", stageIfFails: "DAY7", nextAttemptAt: new Date(dueAt.getTime() + 14 * DAY) };
  return { action: "none" };
}

/** When the first dunning retry is due after a failed renewal charge. */
export function firstRetryAt(dueAt: Date): Date {
  return new Date(dueAt.getTime() + 3 * DAY);
}
