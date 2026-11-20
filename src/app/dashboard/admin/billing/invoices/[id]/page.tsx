/**
 * /dashboard/admin/billing/invoices/[id] — Nexa admin: any workspace's
 * invoice, with void and mark paid off-site on an open one and refunds on
 * card payments (adminGetPlatformInvoice, contracts/billing.md section 4).
 */

import { notFound } from "next/navigation";

import { adminGetPlatformInvoice, adminGetWorkspaceBilling } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame, adminBillingRoutes } from "@/features/courses/components/admin-billing";
import { AdminInvoiceDetail } from "@/features/courses/components/admin-billing-detail";

export const metadata = { title: "Invoice · Billing admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInvoicePage({ params }: PageProps) {
  const { ctx, canOverride } = await requireAdminBillingPage();
  const { id } = await params;
  let invoice;
  try {
    invoice = await adminGetPlatformInvoice({ id });
  } catch (e) {
    if ((e as { code?: string }).code === "NOT_FOUND") notFound();
    throw e;
  }
  const ws = await adminGetWorkspaceBilling({ workspaceId: invoice.workspaceId });
  return (
    <AdminBillingFrame
      page={[
        { label: "Workspaces", href: adminBillingRoutes.workspaces },
        { label: ws.name, href: adminBillingRoutes.workspace(invoice.workspaceId) },
        { label: invoice.number },
      ]}
      title={invoice.number}
    >
      <AdminInvoiceDetail invoice={invoice} workspaceName={ws.name} ctx={ctx} canOverride={canOverride} />
    </AdminBillingFrame>
  );
}
