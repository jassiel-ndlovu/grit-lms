/**
 * /dashboard/fees — what students' parents owe, who has paid, and cash or
 * EFT received outside Nexa (a/ux/04 §6; contracts/billing.md section 3).
 * Behind BILLING=1. Staff with `fees.manage` get the list below; a guardian
 * (`fees.pay`) or an adult student allowed to see fees gets what they owe
 * and pays it (section 2, FeeCheckout). a tutor whose permission is scoped
 * sees the courses they teach. `?status=OPEN|PAID|ALL` (default OPEN),
 * `?course=` and `?cursor=` go to listFeeInvoices. `?recovery=` is where the
 * refund-recovery pay link lands (section 3); refunds still being taken
 * from payouts show above the list.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Receipt } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { isBillingEnabled } from "@/features/billing/errors";
import { feeCourses } from "@/features/courses/fee-courses";
import { FeeCheckout, type PayableRow } from "@/features/courses/components/fee-checkout";
import { NewFeeButton } from "@/features/courses/components/fee-dialogs";
import { PayoutRecoveries, RecoveryNotice } from "@/features/courses/components/fee-recoveries";
import { FeeFilters, FeesTable, feesHref, type FeeFilter } from "@/features/courses/components/fees-list";
import { payoutErrorMessage } from "@/features/courses/lib/payouts-ui";
import { getPayoutSettings, listFeeInvoices, listPayableInvoices, listPayoutRecoveries } from "@/features/payments/fee-queries";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale, type DateContext } from "@/lib/datetime";
import { can, getViewer, type Viewer } from "@/lib/viewer";
import { needsScope } from "@/lib/viewer-core";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Fees" };

interface PageProps {
  searchParams: Promise<{ status?: string; course?: string; cursor?: string; recovery?: string }>;
}

export default async function FeesPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!can(viewer, "fees.manage")) {
    if (isPayer(viewer)) return <PayerFees viewer={viewer} />;
    // A learner whose fees someone else pays (a minor, often with no parent
    // linked yet): say who handles them instead of a 404 (#196, F8).
    if (viewer.learner) return <FeesHandledElsewhere />;
    notFound();
  }
  if (!viewer.workspace) notFound();

  const [sp, prefs, courses] = await Promise.all([searchParams, getUserPreferences(viewer.user.id), feeCourses(viewer)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const status: FeeFilter = sp.status === "PAID" || sp.status === "ALL" ? sp.status : "OPEN";
  const courseId = typeof sp.course === "string" && courses.some((c) => c.id === sp.course) ? sp.course : null;
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : null;

  const shell = (children: React.ReactNode) => (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Fees" }]}
      actions={
        <>
          {needsScope(viewer, "fees.manage") ? null : (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/fees/discounts">Discount codes</Link>
            </Button>
          )}
          <NewFeeButton courses={courses} />
        </>
      }
    >
      <PageTitle icon={<Receipt />} title="Fees" />
      <RecoveryNotice state={sp.recovery} />
      {children}
    </PageFrame>
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

/* ───── Paying fees: guardians and adult students ───── */

/** Mirrors A's checkout rule: a guardian with fees.pay, or a learner who sees their own fees. */
function isPayer(viewer: Viewer): boolean {
  return (viewer.children.length > 0 && can(viewer, "fees.pay")) || viewer.learner?.paymentVisible === true;
}

function dayIn(iso: string, ctx: DateContext): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

async function PayerFees({ viewer }: { viewer: Viewer }) {
  const prefs = await getUserPreferences(viewer.user.id);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const forSelf = !(viewer.children.length > 0 && can(viewer, "fees.pay"));
  const shell = (children: React.ReactNode) => (
    <PageFrame type="settings" breadcrumb={[{ label: "Fees" }]}>
      <PageTitle icon={<Receipt />} title="Fees" />
      {children}
    </PageFrame>
  );

  let items;
  try {
    items = await listPayableInvoices();
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = (e as { message?: string }).message ?? "";
    return shell(
      <p role="alert" className="text-muted-foreground text-sm">
        We couldn&apos;t load your fees. {code ? payoutErrorMessage(`${code}: ${message}`) : null}{" "}
        <Link href="/dashboard/fees" className="text-foreground underline underline-offset-2">
          Try again
        </Link>
      </p>,
    );
  }

  const rows: PayableRow[] = items.map((i) => ({
    ...i,
    dueDay: dayIn(i.dueAt, ctx),
    dueLabel: formatDate(i.dueAt, ctx),
    lockedLabel: i.lockedUntil ? formatDate(i.lockedUntil, ctx, { hour: "2-digit", minute: "2-digit" }) : null,
  }));
  return shell(
    <FeeCheckout
      open={rows.filter((r) => r.status === "OPEN")}
      paid={rows.filter((r) => r.status === "PAID").reverse()}
      today={dayIn(new Date().toISOString(), ctx)}
      forSelf={forSelf}
    />,
  );
}

/** #196: a student who doesn't see or pay fees, often a minor with no parent linked. */
function FeesHandledElsewhere() {
  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Fees" }]}>
      <PageTitle icon={<Receipt />} title="Fees" />
      <div className="bg-muted/60 space-y-1 rounded-lg p-4 text-sm">
        <p className="text-foreground font-medium">Your fees are handled by your parent or your tutor.</p>
        <p className="text-muted-foreground">Ask your tutor if you need to pay.</p>
      </div>
    </PageFrame>
  );
}
