/**
 * /dashboard/fees — what students' parents owe, who has paid, and cash or
 * EFT received outside Nexa (a/ux/04 §6; contracts/billing.md section 3).
 * Behind BILLING=1 and `fees.manage`; a tutor whose permission is scoped
 * sees the courses they teach. `?status=OPEN|PAID|ALL` (default OPEN),
 * `?course=` and `?cursor=` go to listFeeInvoices. `?recovery=` is where the
 * refund-recovery pay link lands (section 3); refunds still being taken
 * from payouts show above the list.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { isBillingEnabled } from "@/features/billing/errors";
import { feeCourses } from "@/features/courses/fee-courses";
import { NewFeeButton } from "@/features/courses/components/fee-dialogs";
import { PayoutRecoveries, RecoveryNotice } from "@/features/courses/components/fee-recoveries";
import { FeeFilters, FeesTable, feesHref, type FeeFilter } from "@/features/courses/components/fees-list";
import { payoutErrorMessage } from "@/features/courses/lib/payouts-ui";
import { getPayoutSettings, listFeeInvoices, listPayoutRecoveries } from "@/features/payments/fee-queries";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Fees" };

interface PageProps {
  searchParams: Promise<{ status?: string; course?: string; cursor?: string; recovery?: string }>;
}

export default async function FeesPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "fees.manage")) notFound();

  const [sp, prefs, courses] = await Promise.all([searchParams, getUserPreferences(viewer.user.id), feeCourses(viewer)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const status: FeeFilter = sp.status === "PAID" || sp.status === "ALL" ? sp.status : "OPEN";
  const courseId = typeof sp.course === "string" && courses.some((c) => c.id === sp.course) ? sp.course : null;
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : null;

  const shell = (children: React.ReactNode) => (
    <>
      <PageHeader breadcrumb={[{ label: "Fees" }]} actions={<NewFeeButton courses={courses} />} />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">Fees</h1>
        <RecoveryNotice state={sp.recovery} />
        {children}
      </div>
    </>
  );

  let list, payouts, recoveries;
  try {
    [list, payouts, recoveries] = await Promise.all([
      listFeeInvoices({
        ...(status === "ALL" ? {} : { status }),
        ...(courseId ? { courseId } : {}),
        ...(cursor ? { cursor } : {}),
      }),
      getPayoutSettings(),
      // Fees still show if this fails; the recoveries just don't.
      listPayoutRecoveries().catch((e: unknown) => {
        console.error("[fees] recoveries not loaded:", (e as Error).message);
        return [];
      }),
    ]);
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = (e as { message?: string }).message ?? "";
    return shell(
      <p role="alert" className="text-muted-foreground text-sm">
        We couldn&apos;t load fees. {code ? payoutErrorMessage(`${code}: ${message}`) : null}{" "}
        <Link href={feesHref({ status, courseId })} className="text-foreground underline underline-offset-2">
          Try again
        </Link>
      </p>,
    );
  }

  // The account fees are paid into is missing: in WORKSPACE mode the
  // workspace's, in PER_TUTOR mode the viewer's own (for their courses).
  const membershipId = viewer.membership?.id ?? null;
  const noAccount =
    payouts.payoutMode === "PER_TUTOR"
      ? !payouts.accounts.some((a) => a.membershipId != null && a.membershipId === membershipId && a.status !== "DISABLED")
      : !payouts.accounts.some((a) => a.membershipId == null && a.status !== "DISABLED");

  return shell(
    <>
      {noAccount ? (
        <div role="status" className="border-warning/40 bg-warning/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
          <span>
            {payouts.payoutMode === "PER_TUTOR"
              ? "Connect your payout account to send fees for your courses."
              : "Connect a payout account to send fees. Parents then pay online, or you mark fees paid when you collect them."}
          </span>
          <Link href="/dashboard/settings/payouts" className="text-foreground font-medium underline underline-offset-2">
            Set up payouts
          </Link>
        </div>
      ) : null}
      <PayoutRecoveries items={recoveries} ctx={ctx} now={new Date().toISOString()} />
      <FeeFilters status={status} courseId={courseId} courses={courses} />
      <FeesTable
        list={list}
        ctx={ctx}
        canMarkOffsite={can(viewer, "fees.markOffsite")}
        status={status}
        courseId={courseId}
        firstPage={!cursor}
      />
    </>,
  );
}
