/**
 * Nexa admin billing queries (docs/revamp/contracts/billing.md, section 4).
 * Permission `admin.console`. Server only.
 */

import "server-only";

import { lifetimeVolume } from "@/features/payments/reconcile";
import { prisma } from "@/lib/db";
import { requireViewer, type BillingState } from "@/lib/viewer";

export type AdminWorkspaceBillingRow = {
  workspaceId: string;
  name: string;
  kind: "ORGANISATION" | "SOLO";
  state: BillingState;
  trialEndsAt: string | null;
  renewsAt: string | null;
  /** Total of the last paid invoice. */
  lastPeriodCents: number | null;
  /** Open invoices past their due date. */
  overdueCents: number;
  deleteAfter: string | null;
};

/** Workspaces with their billing, by name. `q` matches the name or slug; `cursor` is the last workspaceId of the previous page. */
export async function adminListWorkspaceBilling(input: { state?: BillingState; q?: string; cursor?: string; limit?: number } = {}) {
  await requireViewer({ permission: "admin.console" });
  return adminListWorkspaceBillingFor(input);
}

/** adminListWorkspaceBilling without the permission check (scripts). */
export async function adminListWorkspaceBillingFor(input: { state?: BillingState; q?: string; cursor?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const q = input.q?.trim();
  const rows = await prisma.workspace.findMany({
    where: {
      ...(input.state ? { billingState: input.state } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true, name: true, kind: true, billingState: true, trialEndsAt: true,
      subscription: { select: { renewsAt: true, deleteAfter: true } },
    },
  });
  const page = rows.slice(0, limit);
  const ids = page.map((w) => w.id);
  const now = new Date();
  const [lastPaid, overdue] = await Promise.all([
    prisma.platformInvoice.findMany({
      where: { workspaceId: { in: ids }, status: "PAID" },
      orderBy: { paidAt: "desc" },
      distinct: ["workspaceId"],
      select: { workspaceId: true, totalCents: true },
    }),
    prisma.platformInvoice.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: ids }, OR: [{ status: "PAST_DUE" }, { status: "OPEN", dueAt: { lt: now } }] },
      _sum: { totalCents: true },
    }),
  ]);
  const paidBy = new Map(lastPaid.map((p) => [p.workspaceId, p.totalCents]));
  const overdueBy = new Map(overdue.map((o) => [o.workspaceId, o._sum.totalCents ?? 0]));
  const items: AdminWorkspaceBillingRow[] = page.map((w) => ({
    workspaceId: w.id,
    name: w.name,
    kind: w.kind,
    state: w.billingState as BillingState,
    trialEndsAt: w.trialEndsAt?.toISOString() ?? null,
    renewsAt: w.subscription?.renewsAt?.toISOString() ?? null,
    lastPeriodCents: paidBy.get(w.id) ?? null,
    overdueCents: overdueBy.get(w.id) ?? 0,
    deleteAfter: w.subscription?.deleteAfter?.toISOString() ?? null,
  }));
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}

/** Money collected through Paystack against the sole-proprietor limit (R1,000,000). */
export async function adminGetPaymentVolume() {
  await requireViewer({ permission: "admin.console" });
  const v = await lifetimeVolume();
  return { lifetimeCents: v.lifetimeCents, capCents: v.capCents, percent: Math.round(v.usedBps) / 100 };
}
