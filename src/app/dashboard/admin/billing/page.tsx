/**
 * /dashboard/admin/billing — Nexa admin: every workspace's billing, the
 * Paystack volume, and per-workspace overrides (contracts/billing.md
 * section 4). `?q=`, `?state=` and `?cursor=` go to adminListWorkspaceBilling.
 * Behind BILLING=1, the admin persona and `admin.console`.
 */

import { adminGetPaymentVolume, adminListWorkspaceBilling } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import {
  AdminBillingFrame,
  BILLING_STATES,
  VolumeMeter,
  WorkspaceFilters,
  WorkspaceTable,
  adminBillingRoutes,
} from "@/features/courses/components/admin-billing";
import type { BillingState } from "@/features/courses/lib/billing-ui";

export const metadata = { title: "Billing admin" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ q?: string; state?: string; cursor?: string }>;
}

export default async function AdminBillingPage({ searchParams }: PageProps) {
  const { ctx, canOverride } = await requireAdminBillingPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const state = BILLING_STATES.includes(sp.state as BillingState) ? (sp.state as BillingState) : null;
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;

  const [list, volume] = await Promise.all([
    adminListWorkspaceBilling({ q: q || undefined, state: state ?? undefined, cursor, limit: PAGE_SIZE }),
    adminGetPaymentVolume(),
  ]);

  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(state ? { state } : {}), ...extra });
    const s = p.toString();
    return s ? `${adminBillingRoutes.workspaces}?${s}` : adminBillingRoutes.workspaces;
  };

  return (
    <AdminBillingFrame title="Workspaces">
      <VolumeMeter volume={volume} />
      <WorkspaceFilters q={q} state={state} />
      <WorkspaceTable
        list={list}
        ctx={ctx}
        canOverride={canOverride}
        olderHref={list.nextCursor ? query({ cursor: list.nextCursor }) : null}
        newestHref={cursor ? query({}) : null}
        filtered={Boolean(q || state)}
      />
      {canOverride ? null : (
        <p className="text-muted-foreground text-xs">You can view billing here; changing it needs the admin override permission.</p>
      )}
    </AdminBillingFrame>
  );
}
