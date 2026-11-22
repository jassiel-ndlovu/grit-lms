/**
 * /dashboard/manage-courses/[id]/services — premium services for one course
 * (a/ux/03-billing.md §2). Behind BILLING=1: without it the route is a 404
 * and the ribbon has no Services link.
 *
 * A's billing calls supply everything shown (contracts/billing.md §1):
 * getCourseServices for the switches, getCourseTiers for the plan line and
 * getBillingOverview for the renewal date. The last two need
 * `billing.view`; a course lead without it still gets the switches.
 */

import { notFound } from "next/navigation";

import { StatusChip } from "@/components/shell/status-chip";
import { getBillingOverview, getCourseServices, getCourseTiers } from "@/features/billing/queries";
import { isBillingEnabled } from "@/features/billing/errors";
import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { CourseFrame, courseRoutes } from "@/features/courses/components/course-frame";
import { CourseServices } from "@/features/courses/components/course-services";
import { TIER_LABEL, billingErrorMessage, formatRand } from "@/features/courses/lib/billing-ui";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Services" };

async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default async function CourseServicesPage({ params }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const { id } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Services" }]}>{loaded.message}</PageMessage>;
  const { course, userId } = loaded;

  const [prefs, servicesResult, tiers, overview] = await Promise.all([
    getUserPreferences(userId),
    getCourseServices({ courseId: id }).then(
      (items) => ({ items, error: null }),
      (e: unknown) => ({ items: null, error: e instanceof Error ? `${(e as { code?: string }).code ?? ""}: ${e.message}` : "" }),
    ),
    optional(getCourseTiers()),
    optional(getBillingOverview()),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const tier = tiers?.find((t) => t.courseId === id) ?? null;
  const inTrial = overview?.state === "TRIAL";
  const renewsOn = overview?.period ? formatDate(new Date(overview.period.renewsAt), ctx, { day: "numeric", month: "short" }) : null;

  return (
    <CourseFrame course={course} page="Services" type="settings">
      <PageTitle
        title="Services"
        description={
          inTrial
            ? "Free during your trial. Switch services on to try them; the plan they need applies once you start paying."
            : undefined
        }
        properties={
          tier ? (
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>Plan:</span>
              <StatusChip tone={tier.billedTierKey === "CORE" ? "neutral" : "info"}>{TIER_LABEL[tier.billedTierKey]}</StatusChip>
              <span>
                {formatRand(tier.unitPriceCents)} per student per 30 days
                {tier.holdUntil
                  ? ` · held until ${formatDate(new Date(tier.holdUntil), ctx, { day: "numeric", month: "short" })}`
                  : ""}
              </span>
            </p>
          ) : null
        }
      />

      {servicesResult.items ? (
        <CourseServices
          courseId={course.id}
          courseName={course.name}
          items={servicesResult.items}
          inTrial={inTrial}
          renewsOn={renewsOn}
          dateCtx={ctx}
        />
      ) : (
        <p role="alert" className="text-muted-foreground text-sm">
          {billingErrorMessage(servicesResult.error)}
        </p>
      )}
    </CourseFrame>
  );
}
