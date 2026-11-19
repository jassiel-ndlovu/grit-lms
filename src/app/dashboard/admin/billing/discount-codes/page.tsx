/**
 * /dashboard/admin/billing/discount-codes — create a Nexa discount code
 * (adminCreateDiscountCode). The list of codes, with Deactivate, follows
 * once A's adminListDiscountCodes exists (asked on #120).
 */

import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame } from "@/features/courses/components/admin-billing";
import { DiscountCodeForm } from "@/features/courses/components/admin-discount-code-form";

export const metadata = { title: "Discount codes · Billing admin" };

export default async function AdminDiscountCodesPage() {
  const { canOverride } = await requireAdminBillingPage();
  return (
    <AdminBillingFrame page={[{ label: "Discount codes" }]} title="Discount codes">
      {canOverride ? (
        <section aria-labelledby="new-code" className="space-y-4">
          <h2 id="new-code" className="text-foreground text-sm font-semibold">
            New code
          </h2>
          <DiscountCodeForm />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Creating codes needs the admin override permission.</p>
      )}
    </AdminBillingFrame>
  );
}
