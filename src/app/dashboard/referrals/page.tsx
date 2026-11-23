/**
 * /dashboard/referrals — referrals (Core; viewer.md Draft 1.16).
 *
 * Students and parents get their own link for each workspace they belong
 * to. Owners and admins see who referred whom (A's rule: `learners.invite`
 * for the whole workspace). Someone who is both sees both; anyone else
 * gets a 404. Rewards aren't decided, so the page mentions none.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Share2 } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { ReferralLinkCard, type ReferralLinkData } from "@/features/courses/components/referral-link";
import { ReferralList, ReferrerTable } from "@/features/courses/components/referral-views";
import { familyWorkspaces } from "@/features/courses/lib/join-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { listReferralsFor, referralLinkFor } from "@/features/workspaces/referrals";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { can, getViewer } from "@/lib/viewer";
import { needsScope } from "@/lib/viewer-core";

export const metadata = { title: "Referrals" };

/** The person's links; a workspace they're no longer active in is left out. */
async function linksFor(userId: string, workspaces: Array<{ id: string; name: string }>): Promise<ReferralLinkData[]> {
  if (workspaces.length === 0) return [];
  const listed = new Set(
    (
      await prisma.courseListing.findMany({
        where: { workspaceId: { in: workspaces.map((w) => w.id) }, workspace: { billingState: { notIn: ["READ_ONLY", "CANCELLED"] } } },
        select: { workspaceId: true },
        distinct: ["workspaceId"],
      })
    ).map((l) => l.workspaceId),
  );
  const links = await Promise.all(
    workspaces.map(async (w) => {
      try {
        const { url, requested, joined } = await referralLinkFor(userId, w.id);
        return { workspaceId: w.id, workspaceName: w.name, url, requested, joined, hasListed: listed.has(w.id) };
      } catch (e) {
        if (e instanceof UserError) return null;
        throw e;
      }
    }),
  );
  return links.filter((l) => l !== null);
}

export default async function ReferralsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");

  const staffWorkspace =
    viewer.workspace && viewer.persona === "staff" && can(viewer, "learners.invite") && !needsScope(viewer, "learners.invite")
      ? viewer.workspace
      : null;
  const families = familyWorkspaces(viewer);
  const family = viewer.persona === "learner" || viewer.persona === "guardian" || families.length > 0;
  if (!staffWorkspace && !family) notFound();

  const [links, staff, prefs, staffListed] = await Promise.all([
    linksFor(viewer.user.id, families),
    staffWorkspace ? listReferralsFor(staffWorkspace.id) : Promise.resolve(null),
    getUserPreferences(viewer.user.id),
    staffWorkspace ? prisma.courseListing.count({ where: { workspaceId: staffWorkspace.id } }) : Promise.resolve(0),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Referrals" }]}>
      <PageTitle
        icon={<Share2 />}
        title={staffWorkspace ? "Referrals" : "Refer a friend"}
        description={
          staffWorkspace
            ? `Families who found ${staffWorkspace.name} through a student's or parent's link.`
            : "Share your link with another family. It opens your tutor's or school's courses, where they can ask to join."
        }
      />

      {staffWorkspace && staff ? (
        staff.referrals.length === 0 ? (
          <EmptyState
            illustration={<Scene name="inbox-empty" />}
            title="No referrals yet"
            description={
              staffListed
                ? "Each of your students and parents has their own link, under Refer a friend. When someone follows it and asks to join a course, it shows here."
                : "Each of your students and parents has their own link, under Refer a friend. List a course in its settings first, so people who follow a link can ask to join."
            }
          />
        ) : (
          <>
            <PageSection id="totals" title="By person">
              <ReferrerTable rows={staff.byReferrer} />
            </PageSection>
            <PageSection id="list" title="Referred families" description="Newest first. A student counts for the first person who referred them.">
              <ReferralList rows={staff.referrals} ctx={ctx} />
            </PageSection>
          </>
        )
      ) : null}

      {family && (links.length > 0 || !staffWorkspace) ? (
        <PageSection id="links" title={staffWorkspace ? "Your own links" : undefined}>
          {links.length > 0 ? (
            <div className="max-w-3xl space-y-4">
              {links.map((l) => (
                <ReferralLinkCard key={l.workspaceId} link={l} />
              ))}
              <p className="text-muted-foreground text-sm">
                Your tutor or school sees who you referred, and you see how many, not their names. Students they already teach, and your own
                family, don&apos;t count.
              </p>
            </div>
          ) : (
            <EmptyState
              illustration={<Scene name="inbox-empty" />}
              title="No link yet"
              description="You get a link once you, or a child linked to your account, are learning with a tutor or school on Nexa."
              action={
                <Link href="/dashboard/courses/browse" className="text-foreground text-sm font-medium underline underline-offset-2">
                  Find courses
                </Link>
              }
            />
          )}
        </PageSection>
      ) : null}
    </PageFrame>
  );
}
