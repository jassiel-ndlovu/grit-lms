/**
 * /dashboard/join-requests — the staff inbox for join requests (#206;
 * viewer.md Draft 1.12). Staff with `learners.invite`: tutors (and owners
 * in tutor mode) see their own courses' requests, owners and admins the
 * whole workspace (A's listJoinRequestsForStaff scope). Waiting requests
 * oldest first; `?status=APPROVED|DECLINED|CANCELLED` shows decided ones.
 *
 * A's emails link here. New screen, so it uses the page frame (#205).
 */

import { notFound, redirect } from "next/navigation";
import { Inbox } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { NoJoinRequests, StaffRequestList } from "@/features/courses/components/join-views";
import { JOIN_STATUS_CHIP, JOIN_STATUSES, joinRoutes, parseJoinStatus } from "@/features/courses/lib/join-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { listJoinRequestsForStaff } from "@/features/workspaces/join-requests";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";
import { courseScopeOf } from "@/lib/viewer-core";

export const metadata = { title: "Join requests" };

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function JoinRequestsPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "learners.invite")) notFound();

  const status = parseJoinStatus((await searchParams).status);
  const scope = courseScopeOf(viewer, "learners.invite");
  const [rows, prefs] = await Promise.all([
    listJoinRequestsForStaff(viewer.workspace.id, scope?.membershipId ?? null, status, scope?.branchIds),
    getUserPreferences(viewer.user.id),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const views = JOIN_STATUSES.map((s) => ({ label: s === "PENDING" ? "Waiting" : JOIN_STATUS_CHIP[s].label, href: joinRoutes.inboxStatus(s) }));

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Join requests" }]}
      secondary={<RibbonNav label="Request status" links={views} current={joinRoutes.inboxStatus(status)} />}
    >
      <PageTitle
        icon={<Inbox />}
        title="Join requests"
        description={
          scope
            ? `Students and parents asking to join ${scope.branchIds.length ? "your branches' courses" : "the courses you teach"}.`
            : `Students and parents asking to join ${viewer.workspace.name}'s listed courses.`
        }
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      <PageSection id="requests">
        {rows.length === 0 ? <NoJoinRequests status={status} /> : <StaffRequestList rows={rows} ctx={ctx} meId={viewer.user.id} />}
      </PageSection>
    </PageFrame>
  );
}
