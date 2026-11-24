/**
 * Paying fees as a parent or an adult student (contracts/billing.md
 * section 2). Pure, so scripts can check it.
 */

export const FEES_RETURN_PATH = "/dashboard/fees/return";

type Payable = { id: string; totalCents: number; status: string; lockedUntil: string | null; child: { userId: string; name: string } };

/** Open and not held by another checkout: can be ticked. */
export function canSelect(i: Pick<Payable, "status" | "lockedUntil">): boolean {
  return i.status === "OPEN" && i.lockedUntil == null;
}

/** What the ticked invoices add up to, before any discount. */
export function selectedTotal(items: readonly Pick<Payable, "id" | "totalCents">[], selected: ReadonlySet<string>): number {
  return items.reduce((sum, i) => (selected.has(i.id) ? sum + i.totalCents : sum), 0);
}

/**
 * Invoices by child, in first-seen order (the list is sorted by due date).
 * An adult student paying their own fees is one group.
 */
export function groupByChild<T extends Pick<Payable, "child">>(items: readonly T[]): Array<{ userId: string; name: string; items: T[] }> {
  const groups = new Map<string, { userId: string; name: string; items: T[] }>();
  for (const i of items) {
    const g = groups.get(i.child.userId) ?? { userId: i.child.userId, name: i.child.name, items: [] };
    g.items.push(i);
    groups.set(i.child.userId, g);
  }
  return [...groups.values()];
}

/** A discount code as typed: trimmed and upper case, or null when empty. */
export function cleanCode(input: string): string | null {
  const s = input.trim().toUpperCase();
  return s === "" ? null : s;
}

/** A's checkout errors ("CODE: detail") in words for the payer. */
export function checkoutErrorMessage(serverError: string | null | undefined): string {
  if (!serverError) return "That didn't work. Check your connection and try again.";
  const m = /^([A-Z_]+):\s*(.+)$/.exec(serverError.trim());
  if (!m) return serverError;
  const [, code, detail] = m;
  switch (code) {
    case "CODE_INVALID":
    case "CODE_EXPIRED":
    case "CODE_USED":
      return `${detail}.`.replace(/\.\.$/, ".");
    case "BILLING_DISABLED":
      return "Online payments aren't switched on yet.";
    case "PROVIDER_ERROR":
      return "We couldn't reach the payment service. Nothing was charged. Try again in a minute.";
    case "NOT_FOUND":
      return "Some of these fees have changed. Refresh the page and try again.";
    default:
      return detail.endsWith(".") ? detail : `${detail}.`;
  }
}

/** The reference Paystack adds to the return URL, if it looks like one. */
export function returnReference(sp: { reference?: string; trxref?: string }): string | null {
  const r = sp.reference ?? sp.trxref;
  return typeof r === "string" && r.length > 0 && r.length <= 128 ? r : null;
}
