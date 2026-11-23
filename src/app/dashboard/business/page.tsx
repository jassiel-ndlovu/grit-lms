/**
 * /dashboard/business — the business dashboard (Plus and Pro; billing.md
 * Draft 1.17): fees, students, six months and each tutor. Staff with
 * `reports.view`; a branch role sees its branches (A's action narrows it).
 * `?period=` is one of PERIODS; `?from=&to=` are days, both counted.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChartPie } from "lucide-react";

import { BusinessDashboard, PeriodPicker } from "@/components/business/dashboard";
import { dayIn, resolvePeriod } from "@/components/business/period";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import HeaderAnalytics from "@/components/illustrations/generated/header-analytics";
import { isBillingEnabled } from "@/features/billing/errors";
import { getBusinessDashboard, getBusinessDashboardStatus } from "@/features/reports/actions";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer, type Viewer } from "@/lib/viewer";
import { staffScope } from "@/lib/viewer-core";

export const metadata = { title: "Business" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

const SCOPE_LINE = {
  WORKSPACE: "Fees and students across your workspace.",
  BRANCHES: "Fees and students on your branches' courses.",
  OWN_COURSES: "Fees and students on your courses.",
} as const;

export default async function BusinessPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "reports.view")) notFound();

  const status = (await getBusinessDashboardStatus({}))?.data;
  if (status && !status.available) return <Frame viewer={viewer}><PlusFeature viewer={viewer} /></Frame>;

  const [sp, prefs] = await Promise.all([searchParams, getUserPreferences(viewer.user.id)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const now = new Date();
  const period = resolvePeriod({ period: one(sp.period), from: one(sp.from), to: one(sp.to) }, ctx.timeZone, now);
  const res = await getBusinessDashboard({ from: period.from.toISOString(), to: period.to.toISOString() });
  const billing = isBillingEnabled();

  return (
    <Frame viewer={viewer}>
      <PeriodPicker period={period} today={dayIn(now, ctx.timeZone)} />
      {res?.data ? (
        <BusinessDashboard
          data={res.data}
          period={period}
          ctx={ctx}
          showMoney={billing}
          showTutors={viewer.workspace.kind === "ORGANISATION"}
          feesHref={billing && can(viewer, "fees.manage") ? "/dashboard/fees" : null}
        />
      ) : (
        <p role="alert" className="text-muted-foreground text-sm">
          {res?.serverError ?? "We couldn't load your figures."}{" "}
          <Link href="/dashboard/business" className="text-foreground underline underline-offset-2">
            Try again
          </Link>
        </p>
      )}
    </Frame>
  );
}

function Frame({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return (
    <PageFrame type="list" breadcrumb={[{ label: "Business" }]}>
      <PageTitle icon={<ChartPie />} title="Business" description={SCOPE_LINE[staffScope(viewer)]} />
      {children}
    </PageFrame>
  );
}

/** Billing is on and no course has a Plus or Pro service. */
function PlusFeature({ viewer }: { viewer: Viewer }) {
  const canTurnOn = can(viewer, "courses.services") && can(viewer, "courses.edit");
  return (
    <EmptyState
      illustration={<HeaderAnalytics />}
      title="The business dashboard is part of Plus and Pro"
      description={
        canTurnOn
          ? "Switch on a Plus or Pro service on any course to see fees, students and tutors here."
          : "It opens once someone who runs the workspace switches on a Plus or Pro service on a course."
      }
      action={
        canTurnOn ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/manage-courses">Go to courses</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
