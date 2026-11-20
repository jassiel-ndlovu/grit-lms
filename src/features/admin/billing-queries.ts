/**
 * Nexa admin billing queries (docs/revamp/contracts/billing.md, section 4).
 * Permission `admin.console`. Server only.
 */

import "server-only";

import { deleteWorkspaceData, planRetention, retentionDeletesEnabled } from "@/features/billing/retention";
import { BillingError } from "@/features/billing/errors";
import { getCourseTiersFor, getPlatformInvoiceFor, listPlatformInvoicesFor } from "@/features/billing/queries";
import { lifetimeVolume } from "@/features/payments/reconcile";
import { listRecoveriesFor } from "@/features/payments/recovery";
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

/**
 * Workspaces past their retention date, with exactly what deleting each
 * would remove (a dry run: nothing changes). Read this before switching on
 * RETENTION_DELETES. Ids and counts only.
 */
export async function adminRetentionPreview() {
  await requireViewer({ permission: "admin.console" });
  return retentionPreviewFor(new Date());
}

export async function retentionPreviewFor(now: Date) {
  const plan = await planRetention(now);
  const items = [];
  for (const p of plan) {
    const ws = await prisma.workspace.findUnique({ where: { id: p.workspaceId }, select: { name: true, subscription: { select: { deleteAfter: true, lastPaidAt: true } } } });
    items.push({
      workspaceId: p.workspaceId,
      name: ws?.name ?? "",
      deleteAfter: ws?.subscription?.deleteAfter?.toISOString() ?? null,
      lastPaidAt: ws?.subscription?.lastPaidAt?.toISOString() ?? null,
      counts: await deleteWorkspaceData(p.workspaceId, { dryRun: true, now }),
    });
  }
  return { deletesEnabled: retentionDeletesEnabled(), items };
}

/**
 * One workspace for the admin console: its list row, courses with tiers
 * (getCourseTiers shape, with `override`) and the first page of invoices.
 */
export async function adminGetWorkspaceBilling(input: { workspaceId: string }) {
  await requireViewer({ permission: "admin.console" });
  const ws = await prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true, slug: true } });
  if (!ws) throw new BillingError("NOT_FOUND", "Workspace not found");
  const list = await adminListWorkspaceBillingFor({ q: ws.slug, limit: 200 });
  const row = list.items.find((i) => i.workspaceId === input.workspaceId);
  if (!row) throw new BillingError("NOT_FOUND", "Workspace not found");
  const [courses, invoices] = await Promise.all([getCourseTiersFor(input.workspaceId), listPlatformInvoicesFor(input.workspaceId, { limit: 20 })]);
  return { ...row, courses, invoices };
}

/**
 * Any workspace's invoice (getPlatformInvoice shape) plus `workspaceId`, and
 * per payment its `paymentId` (null for off-site) and `refundableCents`.
 */
export async function adminGetPlatformInvoice(input: { id: string }) {
  await requireViewer({ permission: "admin.console" });
  const row = await prisma.platformInvoice.findUnique({ where: { id: input.id }, select: { workspaceId: true } });
  if (!row) throw new BillingError("NOT_FOUND", "Invoice not found");
  const inv = await getPlatformInvoiceFor(row.workspaceId, input);
  const payments = await prisma.payment.findMany({
    where: { platformInvoiceId: input.id, status: { in: ["SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, amountCents: true, createdAt: true, paidAt: true, refunds: { where: { status: { in: ["PENDING", "PROCESSED"] } }, select: { amountCents: true } } },
  });
  const offsite = await prisma.offsitePayment.findMany({ where: { platformInvoiceId: input.id, voidedAt: null }, select: { receivedOn: true, amountCents: true } });
  const card = payments.map((p) => ({
    paymentId: p.id as string | null,
    at: (p.paidAt ?? p.createdAt).toISOString(),
    amountCents: p.amountCents,
    via: "CARD" as const,
    status: p.status as string,
    refundableCents: p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" ? p.amountCents - p.refunds.reduce((n, r) => n + r.amountCents, 0) : 0,
  }));
  const off = offsite.map((o) => ({ paymentId: null, at: o.receivedOn.toISOString(), amountCents: o.amountCents, via: "OFFSITE" as const, status: "SUCCEEDED", refundableCents: 0 }));
  return { ...inv, workspaceId: row.workspaceId, payments: [...card, ...off].sort((a, b) => a.at.localeCompare(b.at)) };
}

/** Nexa discount codes, newest first; `redemptions` is how many workspaces used each. */
export async function adminListDiscountCodes(input: { active?: boolean; cursor?: string; limit?: number } = {}) {
  await requireViewer({ permission: "admin.console" });
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const rows = await prisma.discountCode.findMany({
    where: { issuerWorkspaceId: null, ...(input.active === undefined ? {} : { active: input.active }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((c) => ({
      id: c.id, code: c.code, description: c.description, kind: c.kind, percentBps: c.percentBps, amountCents: c.amountCents,
      scope: c.scope, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt?.toISOString() ?? null, maxRedemptions: c.maxRedemptions,
      redemptions: c.redemptionCount, durationPeriods: c.durationPeriods, active: c.active,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

/** Refund recoveries across Nexa, newest first, with what is left on each. `status` filters. */
export async function adminListPayoutRecoveries(input: { status?: "AWAITING_REFUND" | "ACTIVE" | "RECOVERED" | "CANCELLED" | "WAIVED"; workspaceId?: string } = {}) {
  await requireViewer({ permission: "admin.console" });
  const accounts = await prisma.payoutAccount.findMany({
    where: { ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}), recoveries: { some: input.status ? { status: input.status } : {} } },
    select: { id: true, workspaceId: true, businessName: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = await listRecoveriesFor(accounts.map((a) => a.id), new Date(), { includeAwaiting: true });
  return rows
    .filter((r) => !input.status || r.status === input.status)
    .map((r) => ({ ...r, workspaceId: byId.get(r.payoutAccountId)?.workspaceId ?? null, payeeName: byId.get(r.payoutAccountId)?.businessName ?? "" }));
}
