/**
 * Pure helpers for the teaching switch, the restart flow and read-only
 * workspaces (#206, #191, #189), kept apart from the components so
 * scripts/check-decision-screens.ts can check them.
 */

/** The typed name confirms the switch: same as A's check (trimmed, any case). */
export function confirmsName(typed: string, name: string): boolean {
  const t = typed.trim().toLowerCase();
  return t.length > 0 && t === name.trim().toLowerCase();
}

/** A's restartWorkspace results (billing.md Draft 1.15). */
export type RestartResult =
  | { status: "PAY_OUTSTANDING"; invoiceIds: string[] }
  | { status: "PAY_FIRST_PERIOD"; activeStudents: number }
  | { status: "CARD_REQUIRED" }
  | { status: "RESTARTED"; renewsAt: string | Date };

/** What the restart panel says and offers for each result. */
export function restartStep(r: RestartResult): { title: string; body: string; action: "pay-invoices" | "first-payment" | "add-card" | "done" } {
  switch (r.status) {
    case "PAY_OUTSTANDING": {
      const n = r.invoiceIds.length;
      return {
        title: n === 1 ? "Pay the unpaid bill first" : `Pay the ${n} unpaid bills first`,
        body: "Restarting needs the outstanding balance paid. Once it's paid, restart again to start the new period.",
        action: "pay-invoices",
      };
    }
    case "PAY_FIRST_PERIOD":
      return {
        title: "Pay for the first 30 days",
        body: `You have ${r.activeStudents} active student${r.activeStudents === 1 ? "" : "s"}. The workspace opens again as soon as the first payment goes through.`,
        action: "first-payment",
      };
    case "CARD_REQUIRED":
      return {
        title: "Save a card to restart",
        body: "You have no students yet, so the first period costs nothing. Save a card for the renewals (a R10 check, refunded at once), then restart again.",
        action: "add-card",
      };
    case "RESTARTED":
      return { title: "Your workspace is open again", body: "Add students when you're ready. They're billed at the next renewal.", action: "done" };
  }
}

/** The READ_ONLY error A's action clients throw (#189). */
export function isReadOnlyError(serverError: string | null | undefined): boolean {
  return (serverError ?? "").trim().startsWith("READ_ONLY:");
}

/** Shown beside a disabled write control in a read-only workspace. */
export const READ_ONLY_REASON = "Your workspace is read-only. Pay to unlock it.";
