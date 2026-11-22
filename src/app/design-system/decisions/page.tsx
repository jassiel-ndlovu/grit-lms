/**
 * /design-system/decisions — the screens for the owner's decisions of
 * 21 Nov (#206, #191, #189, #196), with sample data and no session:
 * the restart panel in each of its four results, read-only write controls,
 * the teaching switch (owner and Nexa admin), and the fees note for a
 * learner whose fees someone else handles. Buttons that reach the server
 * refuse here (no session). `?theme=bright` previews the Bright theme.
 * Same gate as /design-system: development, or REVAMP_UI=1.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Receipt } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { ReadOnlyNote, WorkspaceAccessProvider, WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { RestartPanel } from "@/features/courses/components/billing-restart";
import { TeachingOffButton, TeachingOnButton } from "@/features/courses/components/teaching-switch";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

import { PageTheme } from "../frame/demo-client";

export const metadata = { title: "Decision screens · Design system", robots: { index: false } };

export default async function DecisionsPreviewPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  if (!canPreviewDesignSystem()) notFound();
  const theme = (await searchParams).theme === "bright" ? "bright" : "calm";

  return (
    <div data-ui="revamp" data-theme={theme} data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageTheme theme={theme} />
      <PageFrame type="list" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Decision screens" }]}>
        <PageTitle
          title="Decision screens"
          description="The owner's decisions of 21 November: restart, read-only workspaces, the teaching switch and the fees note."
          properties={
            <Link className="text-link text-sm underline" href={`/design-system/decisions${theme === "bright" ? "" : "?theme=bright"}`}>
              Show in the {theme === "bright" ? "Calm" : "Bright"} theme
            </Link>
          }
        />

        <PageSection id="restart" title="Restart a cancelled workspace (#191)" description="Billing page. One panel, four answers from restartWorkspace.">
          <div className="grid gap-4 lg:grid-cols-2">
            <RestartPanel cancelled firstPeriodCents={89_700} />
            <RestartPanel cancelled firstPeriodCents={89_700} initial={{ status: "PAY_OUTSTANDING", invoiceIds: ["inv_a", "inv_b"] }} />
            <RestartPanel cancelled firstPeriodCents={89_700} initial={{ status: "PAY_FIRST_PERIOD", activeStudents: 23 }} />
            <RestartPanel cancelled firstPeriodCents={0} initial={{ status: "CARD_REQUIRED" }} />
            <RestartPanel cancelled firstPeriodCents={0} initial={{ status: "RESTARTED", renewsAt: "2026-12-22T00:00:00.000Z" }} />
          </div>
        </PageSection>

        <PageSection id="read-only" title="Read-only workspace (#189)" description="Write controls are disabled and say why; reads stay open.">
          <WorkspaceAccessProvider readOnly>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <WriteGuard label="New course" size="default" variant="default">
                  <Button><Plus className="size-4" /> New course</Button>
                </WriteGuard>
                <WriteGuard label="New test" variant="brand">
                  <Button size="sm" variant="brand">New test</Button>
                </WriteGuard>
                <WriteGuard label="Import JSON">
                  <Button size="sm" variant="outline">Import JSON</Button>
                </WriteGuard>
                <Button size="sm" variant="outline">Export JSON</Button>
              </div>
              <p className="text-sm">
                Inline:{" "}
                <WriteGuard label="New assignment" as="link">
                  <a href="#">New assignment</a>
                </WriteGuard>
              </p>
              <ReadOnlyNote billingHref="/dashboard/settings/billing" />
            </div>
          </WorkspaceAccessProvider>
        </PageSection>

        <PageSection id="teaching" title="Teaching switch (#206)" description="Settings › Organisation for the owner; the admin workspace page for Nexa admins.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border-border space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                Owner <StatusChip tone="success">Teaches</StatusChip>
              </p>
              <p className="text-sm">
                If your organisation only runs things and never teaches, switch teaching off.{" "}
                <strong>Only Nexa support can switch it back on.</strong>
              </p>
              <TeachingOffButton organisationName="Riverside Maths Academy" />
            </div>
            <div className="border-border space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Nexa admin</p>
              <PropertyList>
                <PropertyRow label="Kind">Organisation</PropertyRow>
                <PropertyRow label="Teaching">
                  <span className="inline-flex flex-wrap items-center gap-3">
                    <span>Off since 22 Nov 2026</span>
                    <TeachingOnButton workspaceId="ws_sample" name="Riverside Maths Academy" />
                  </span>
                </PropertyRow>
              </PropertyList>
            </div>
          </div>
        </PageSection>

        <PageSection id="fees" title="Fees for a learner who doesn't pay (#196)">
          <div className="border-border rounded-lg border p-4">
            <p className="flex items-center gap-2 text-lg font-semibold"><Receipt aria-hidden className="size-5" /> Fees</p>
            <div className="bg-muted/60 mt-4 space-y-1 rounded-lg p-4 text-sm">
              <p className="text-foreground font-medium">Your fees are handled by your parent or your tutor.</p>
              <p className="text-muted-foreground">Ask your tutor if you need to pay.</p>
            </div>
          </div>
        </PageSection>
      </PageFrame>
    </div>
  );
}
