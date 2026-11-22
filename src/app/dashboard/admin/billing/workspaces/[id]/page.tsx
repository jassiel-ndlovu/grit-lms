/**
 * /dashboard/admin/billing/workspaces/[id] — Nexa admin: one workspace's
 * billing, its courses' tiers (with overrides) and its newest invoices
 * (adminGetWorkspaceBilling, contracts/billing.md section 4).
 */

import { notFound } from "next/navigation";

import { adminGetWorkspaceBilling } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame, adminBillingRoutes } from "@/features/courses/components/admin-billing";
import { WorkspaceDetail } from "@/features/courses/components/admin-billing-detail";

export const metadata = { title: "Workspace · Billing admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminWorkspaceBillingPage({ params }: PageProps) {
  const { ctx, canOverride } = await requireAdminBillingPage();
  const { id } = await params;
  let ws;
  try {
    ws = await adminGetWorkspaceBilling({ workspaceId: id });
  } catch (e) {
    if ((e as { code?: string }).code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <AdminBillingFrame page={[{ label: "Workspaces", href: adminBillingRoutes.workspaces }, { label: ws.name }]} title={ws.name} type="record">
      <WorkspaceDetail ws={ws} ctx={ctx} canOverride={canOverride} />
    </AdminBillingFrame>
  );
}
