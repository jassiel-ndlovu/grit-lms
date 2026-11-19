/**
 * GET /api/billing/invoices/[id]/pdf: a platform invoice as a PDF
 * (contract section 1, `pdfUrl`). Staff with `billing.view` get their own
 * workspace's invoices; Nexa admins (`admin.console`) any.
 */

import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/features/billing/invoice-pdf";
import { getPlatformInvoiceFor } from "@/features/billing/queries";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const row = await prisma.platformInvoice.findUnique({
    where: { id },
    select: {
      workspaceId: true, dueAt: true, vatRateBps: true,
      workspace: { select: { name: true, timezone: true, subscription: { select: { legalName: true, customerVatNumber: true, billingEmail: true } } } },
    },
  });
  const own = row && viewer.workspace?.id === row.workspaceId && can(viewer, "billing.view");
  if (!row || !(own || can(viewer, "admin.console"))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inv = await getPlatformInvoiceFor(row.workspaceId, { id });
  const sub = row.workspace.subscription;
  const bytes = await renderInvoicePdf({
    number: inv.number,
    status: inv.status,
    issuedAt: new Date(inv.issuedAt),
    dueAt: row.dueAt,
    paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
    periodStart: new Date(inv.periodStart),
    periodEnd: new Date(inv.periodEnd),
    billTo: { name: row.workspace.name, legalName: sub?.legalName ?? null, vatNumber: sub?.customerVatNumber ?? null, email: sub?.billingEmail ?? null },
    lines: inv.lines,
    subtotalCents: inv.subtotalCents,
    discountCents: inv.discountCents,
    creditCents: inv.creditCents,
    vatCents: inv.vatCents,
    vatRateBps: row.vatRateBps,
    totalCents: inv.totalCents,
    timeZone: row.workspace.timezone,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
