/**
 * /dashboard/settings/organisation — the organisation's teaching switch
 * (#206, owner decision 2026-11-21). New screen, so it uses the page frame
 * (#205, Reading width).
 *
 * An organisation that teaches has the Organisation / Tutor switch and its
 * teaching owners and admins are listed as tutors. The OWNER can switch
 * teaching off (switchTeachingOff, strict: typed name); only a Nexa admin
 * switches it back on (adminSwitchTeachingOn, on the admin workspace page).
 * Owners and admins with `workspace.settings` see the page; only the owner
 * gets the button. Solo workspaces always teach, so they 404 here.
 */

import { notFound, redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { TeachingOffButton } from "@/features/courses/components/teaching-switch";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Organisation · Settings" };

export default async function OrganisationSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const ws = viewer.workspace;
  if (!ws || ws.kind !== "ORGANISATION" || !can(viewer, "workspace.settings")) notFound();

  const [row, prefs] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ws.id }, select: { teachingOffAt: true } }),
    getUserPreferences(viewer.user.id),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const isOwner = viewer.membership?.role === "OWNER";
  const teaches = ws.teaches;

  return (
    <PageFrame
      type="settings"
      breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Organisation" }]}
      status={<StatusChip tone={teaches ? "success" : "neutral"}>{teaches ? "Teaches" : "Doesn't teach"}</StatusChip>}
    >
      <PageTitle
        icon={<Building2 />}
        eyebrow="Settings"
        title={ws.name}
        description="How your organisation works on Nexa."
        properties={
          <PropertyList>
            <PropertyRow label="Kind">Organisation</PropertyRow>
            <PropertyRow label="Your role">{viewer.membership?.role === "OWNER" ? "Owner" : "Admin"}</PropertyRow>
          </PropertyList>
        }
      />

      <PageSection
        id="teaching"
        title="Teaching"
        description={
          teaches
            ? "Your organisation teaches: owners and admins can teach courses, appear as tutors, and switch between Organisation and Tutor mode in the sidebar."
            : "Your organisation doesn't teach. Owners and admins run it; tutors teach the courses."
        }
      >
        {teaches ? (
          <div className="border-border space-y-3 rounded-lg border p-4">
            <p className="text-sm">
              If your organisation only runs things and never teaches, switch teaching off. Owners and admins then stop
              appearing as tutors. <strong>Only Nexa support can switch it back on.</strong>
            </p>
            {isOwner ? (
              <TeachingOffButton organisationName={ws.name} />
            ) : (
              <p className="text-muted-foreground text-sm">Only the organisation&apos;s owner can switch teaching off.</p>
            )}
          </div>
        ) : (
          <div className="bg-muted/60 space-y-1 rounded-lg p-4 text-sm">
            <p className="text-foreground font-medium">
              Teaching is off{row?.teachingOffAt ? ` since ${formatDate(row.teachingOffAt, ctx, { day: "numeric", month: "long", year: "numeric" })}` : ""}.
            </p>
            <p className="text-muted-foreground">
              To teach again, contact Nexa support. Only a Nexa admin can switch teaching back on.
            </p>
          </div>
        )}
      </PageSection>
    </PageFrame>
  );
}
