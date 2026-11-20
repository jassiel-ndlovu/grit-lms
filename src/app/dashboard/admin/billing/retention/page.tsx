/**
 * /dashboard/admin/billing/retention — Nexa admin: workspaces past their
 * retention date and what deleting each would remove. A dry run
 * (adminRetentionPreview): reading it changes nothing.
 */

import { adminRetentionPreview } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame } from "@/features/courses/components/admin-billing";
import { RetentionTable } from "@/features/courses/components/admin-billing-detail";

export const metadata = { title: "Retention · Billing admin" };

export default async function AdminRetentionPage() {
  const { ctx } = await requireAdminBillingPage();
  const preview = await adminRetentionPreview();
  return (
    <AdminBillingFrame page={[{ label: "Retention" }]} title="Retention">
      <RetentionTable preview={preview} ctx={ctx} />
    </AdminBillingFrame>
  );
}
