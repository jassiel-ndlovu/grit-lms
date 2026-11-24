/**
 * /dashboard/settings/payouts — the bank account parents' payments go to
 * (a/ux/04 §7; contracts/billing.md section 3). Behind BILLING=1.
 *
 *   - WORKSPACE mode: one account for the workspace, connected by someone
 *     with `payouts.connect` (owner or admin).
 *   - PER_TUTOR mode (organisations): each tutor connects their own; people
 *     who can see everyone's also get a table of the tutors' accounts.
 *   - Organisations choose the mode here (`workspace.settings`).
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { isBillingEnabled } from "@/features/billing/errors";
import { PayoutConnect, PayoutModeSwitch } from "@/features/courses/components/payout-connect";
import { PAYOUT_STATUS, accountLabel, payoutErrorMessage } from "@/features/courses/lib/payouts-ui";
import { getPayoutSettings, listBanks } from "@/features/payments/fee-queries";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !(can(viewer, "payouts.connect") || can(viewer, "fees.manage"))) notFound();

  const body = (children: React.ReactNode) => (
    <PageFrame type="settings" breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Payouts" }]}>
      <PageTitle
        title="Payouts"
        description={
          <>
            Parents&apos; payments through Nexa go straight to this account; Nexa never holds them. Nexa keeps 2%, and the card
            or EFT fee comes off the same payment.
          </>
        }
      />
      {children}
    </PageFrame>
  );

  let settings: Awaited<ReturnType<typeof getPayoutSettings>>;
  let banks: Awaited<ReturnType<typeof listBanks>>;
  try {
    [settings, banks] = await Promise.all([getPayoutSettings(), listBanks()]);
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = (e as { message?: string }).message;
    return body(
      <p role="alert" className="text-muted-foreground text-sm">
        We couldn&apos;t load your payout settings. {code ? payoutErrorMessage(`${code}: ${message ?? ""}`) : null}
      </p>,
    );
  }

  const perTutor = settings.payoutMode === "PER_TUTOR";
  const membershipId = viewer.membership && !viewer.membership.id.startsWith("legacy_") ? viewer.membership.id : null;
  const mine = perTutor
    ? (settings.accounts.find((a) => a.membershipId != null && a.membershipId === membershipId) ?? null)
    : (settings.accounts.find((a) => a.membershipId == null) ?? null);
  // Who may connect the account this page is about (as connectPayoutAccount checks).
  const canConnect = perTutor ? membershipId != null : can(viewer, "payouts.connect");
  const canSetMode = viewer.workspace.kind === "ORGANISATION" && can(viewer, "workspace.settings");
  const seesEveryone = perTutor && (can(viewer, "payouts.connect") || can(viewer, "workspace.settings"));
  const tutors = settings.accounts.filter((a) => a.membershipId != null && a.membershipId !== membershipId);

  return body(
    <>
      {canSetMode ? <PayoutModeSwitch mode={settings.payoutMode} /> : null}

      <section aria-labelledby="account-heading" className="space-y-4">
        <h2 id="account-heading" className="text-foreground text-sm font-semibold">
          {perTutor ? "Your account" : viewer.workspace.kind === "ORGANISATION" ? "The organisation's account" : "Your account"}
        </h2>
        {mine ? (
          <PropertyList>
            <PropertyRow label="Account">{accountLabel(mine)}</PropertyRow>
            <PropertyRow label="Account holder">{mine.accountName}</PropertyRow>
            <PropertyRow label="Business name">{mine.businessName}</PropertyRow>
            <PropertyRow label="Status">
              <StatusChip tone={PAYOUT_STATUS[mine.status].tone}>{PAYOUT_STATUS[mine.status].label}</StatusChip>
            </PropertyRow>
          </PropertyList>
        ) : (
          <p className="text-muted-foreground text-sm">
            No account connected yet. Fees can be sent to parents once it is, and then paid online or marked paid when you
            collect cash or EFT.
          </p>
        )}
        {mine?.status === "ACTIVE" ? (
          <p className="text-muted-foreground text-xs">The first payment into a new bank account can take a few extra days while the account is checked.</p>
        ) : null}
        {canConnect ? (
          <PayoutConnect banks={banks} current={mine} defaultBusinessName={mine?.businessName ?? viewer.workspace.name} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {perTutor ? "Ask the owner to add you as staff in this organisation." : "The owner or an admin connects this account."}
          </p>
        )}
      </section>

      {seesEveryone ? (
        <section aria-labelledby="tutors-heading" className="space-y-3">
          <h2 id="tutors-heading" className="text-foreground text-sm font-semibold">
            Tutors&apos; accounts
          </h2>
          {tutors.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tutor has connected an account yet. Each tutor does it on this page.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="text-muted-foreground border-border border-b text-left text-xs">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Business name</th>
                    <th className="py-2 pr-3 font-medium">Account</th>
                    <th className="py-2 pr-3 font-medium">Holder</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {tutors.map((a) => (
                    <tr key={a.id}>
                      <td className="text-foreground py-2 pr-3">{a.businessName}</td>
                      <td className="py-2 pr-3 tabular-nums">{accountLabel(a)}</td>
                      <td className="py-2 pr-3">{a.accountName}</td>
                      <td className="py-2">
                        <StatusChip tone={PAYOUT_STATUS[a.status].tone}>{PAYOUT_STATUS[a.status].label}</StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-muted-foreground text-xs">A course&apos;s fees go to its lead tutor&apos;s account; its fees can be sent once that account is connected.</p>
        </section>
      ) : null}
    </>,
  );
}
