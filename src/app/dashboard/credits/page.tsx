/**
 * /dashboard/credits — study credits (billing.md "AI credit top-ups"): a
 * student's own, or each child's for a parent (`?child=` shows one). Behind
 * BILLING=1. Organisations buy theirs in Settings › Billing.
 */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { isBillingEnabled } from "@/features/billing/errors";
import { StudyAccountSection } from "@/features/courses/components/study/credits-views";
import { studyRoutes } from "@/features/courses/lib/study-ui";
import { studyAccounts } from "@/features/courses/study";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Study credits" };

interface PageProps {
  searchParams: Promise<{ child?: string | string[] }>;
}

export default async function CreditsPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (viewer.persona === "staff" && can(viewer, "billing.view")) redirect(studyRoutes.workspaceCredits);
  const guardian = viewer.persona === "guardian";
  if (!guardian && viewer.persona !== "learner") notFound();

  const wanted = (await searchParams).child;
  const child = guardian ? (viewer.children.find((c) => c.userId === wanted) ?? null) : null;
  const [accounts, prefs] = await Promise.all([studyAccounts(viewer, child?.userId), getUserPreferences(viewer.user.id)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  // Name the organisation only for a child who learns at more than one.
  const several = (userId: string) => accounts.filter((a) => a.studentUserId === userId).length > 1;

  return (
    <PageFrame type="record" breadcrumb={[{ label: "Study credits" }]}>
      <PageTitle
        title="Study credits"
        description={
          guardian
            ? "Your children use these to ask the study assistant about their lessons. Each answer uses some."
            : "You use these to ask the study assistant about your lessons. Each answer uses some."
        }
      />
      {accounts.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            compact
            illustration={<Scene name="empty-courses" />}
            title="No study assistant yet"
            description="When a course has the study assistant, you can buy credits for it here."
          />
        </Card>
      ) : (
        accounts.map((a) => (
          <StudyAccountSection
            key={`${a.studentUserId}:${a.workspace.id}`}
            account={a}
            ctx={ctx}
            title={guardian ? (several(a.studentUserId) ? `${a.name}, ${a.workspace.name}` : a.name) : null}
          />
        ))
      )}
    </PageFrame>
  );
}
