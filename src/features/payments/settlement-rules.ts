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
