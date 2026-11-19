/**
 * Nexa admin billing (contracts/billing.md section 4): the frame, the
 * Paystack volume meter and the workspace list. Pure display of what
 * adminListWorkspaceBilling and adminGetPaymentVolume return; the pages
 * load them. Actions are in admin-workspace-actions.tsx.
 */

import Link from "next/link";

import { PageHeader, type Crumb } from "@/components/shell/page-header";
import { Ribbon, RibbonNav } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { adminGetPaymentVolume, adminListWorkspaceBilling } from "@/features/admin/billing-queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { STATE_CHIP, capTone, formatRand, type BillingState } from "../lib/billing-ui";
import { WorkspaceActions } from "./admin-workspace-actions";

export type AdminWorkspaceList = Awaited<ReturnType<typeof adminListWorkspaceBilling>>;
export type PaymentVolume = Awaited<ReturnType<typeof adminGetPaymentVolume>>;

export const adminBillingRoutes = {
  workspaces: "/dashboard/admin/billing",
  discountCodes: "/dashboard/admin/billing/discount-codes",
};

export const BILLING_STATES: BillingState[] = ["TRIAL", "ACTIVE", "PAST_DUE", "READ_ONLY", "COMPED", "CANCELLED"];

export function AdminBillingFrame({ page, title, children }: { page?: Crumb[]; title: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        breadcrumb={[page?.length ? { label: "Billing admin", href: adminBillingRoutes.workspaces } : { label: "Billing admin" }, ...(page ?? [])]}
      />
      <Ribbon>
        <RibbonNav
          label="Billing admin"
          links={[
            { label: "Workspaces", href: adminBillingRoutes.workspaces },
            { label: "Discount codes", href: adminBillingRoutes.discountCodes },
          ]}
        />
      </Ribbon>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {children}
      </div>
    </>
  );
}

const BAR: Record<string, string> = { neutral: "bg-primary", warning: "bg-warning", danger: "bg-destructive" };

/** Money taken through Paystack against the sole-proprietor limit. */
export function VolumeMeter({ volume }: { volume: PaymentVolume }) {
  const pct = Math.min(Math.max(volume.percent, 0), 100);
  const tone = capTone(volume.percent);
  return (
    <section aria-labelledby="volume-heading" className="space-y-1.5 text-sm">
      <div className="flex flex-wrap justify-between gap-x-4">
        <h2 id="volume-heading" className="text-foreground font-semibold">
          Paystack volume
        </h2>
        <span className="text-muted-foreground tabular-nums">
          {formatRand(volume.lifetimeCents)} of {formatRand(volume.capCents)} · {volume.percent.toLocaleString("en-ZA")}%
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby="volume-heading"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <div className={`h-full ${BAR[tone] ?? BAR.neutral}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-muted-foreground block text-xs">
        All money collected through Paystack so far, against the sole-proprietor limit.
        {tone !== "neutral" ? " Plan the move to a company account before the limit." : ""}
      </p>
    </section>
  );
}

export function WorkspaceFilters({ q, state }: { q: string; state: BillingState | null }) {
  return (
    <form method="get" action={adminBillingRoutes.workspaces} role="search" className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="ws-q" className="text-muted-foreground block text-xs">
          Name or slug
        </label>
        <input
          id="ws-q"
          name="q"
          defaultValue={q}
          className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ws-state" className="text-muted-foreground block text-xs">
          State
        </label>
        <select
          id="ws-state"
          name="state"
          defaultValue={state ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any</option>
          {BILLING_STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_CHIP[s].label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Filter
      </button>
      {q || state ? (
        <Link href={adminBillingRoutes.workspaces} className="text-muted-foreground hover:text-foreground self-center text-sm underline underline-offset-2">
          Clear
        </Link>
      ) : null}
    </form>
  );
}

export function WorkspaceTable({
  list,
  ctx,
  canOverride,
  olderHref,
  newestHref,
  filtered,
}: {
  list: AdminWorkspaceList;
  ctx: DateContext;
  canOverride: boolean;
  olderHref: string | null;
  newestHref: string | null;
  filtered: boolean;
}) {
  const day = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });
  if (list.items.length === 0 && !newestHref) {
    return (
      <EmptyState
        compact
        title={filtered ? "No workspaces match" : "No workspaces yet"}
        description={filtered ? "Try another name, or any state." : "Workspaces show here once someone signs up."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">Workspace</th>
              <th className="py-2 pr-3 font-medium">State</th>
              <th className="py-2 pr-3 font-medium">Next date</th>
              <th className="py-2 pr-3 text-right font-medium">Last period</th>
              <th className="py-2 pr-3 text-right font-medium">Overdue</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {list.items.map((w) => {
              const chip = STATE_CHIP[w.state];
              const next =
                w.deleteAfter && w.state !== "COMPED"
                  ? { label: "Data deleted on", date: w.deleteAfter, danger: true }
                  : w.state === "TRIAL" && w.trialEndsAt
                    ? { label: "Trial ends", date: w.trialEndsAt, danger: false }
                    : w.renewsAt
                      ? { label: "Renews", date: w.renewsAt, danger: false }
                      : null;
              return (
                <tr key={w.workspaceId}>
                  <td className="py-2 pr-3">
                    <span className="text-foreground">{w.name}</span>
                    <span className="text-muted-foreground block text-xs">{w.kind === "SOLO" ? "Solo tutor" : "Organisation"}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </td>
                  <td className="py-2 pr-3">
                    {next ? (
                      <span className={next.danger ? "text-destructive" : undefined}>
                        <span className="text-muted-foreground text-xs">{next.label} </span>
                        {day(next.date)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {w.lastPeriodCents != null ? formatRand(w.lastPeriodCents) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${w.overdueCents > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {w.overdueCents > 0 ? formatRand(w.overdueCents) : "—"}
                  </td>
                  <td className="py-2 text-right">{canOverride ? <WorkspaceActions workspace={w} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {olderHref || newestHref ? (
        <nav aria-label="Pages" className="flex gap-4 text-sm">
          {newestHref ? (
            <Link href={newestHref} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              First page
            </Link>
          ) : null}
          {olderHref ? (
            <Link href={olderHref} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
