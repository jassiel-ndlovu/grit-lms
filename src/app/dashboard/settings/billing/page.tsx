/**
 * /dashboard/settings/billing — the billing overview (a/ux/03-billing.md §1).
 * Answers "when do I pay next, how much, and why?". Behind BILLING=1 and
 * `billing.view`; every amount comes from A's getBillingOverview and
 * getCourseTiers (billing.md, rules for B, 1). Paying and the card arrive
 * with A's payPlatformInvoice and startCardCapture.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isBillingEnabled } from "@/features/billing/errors";
import { getBillingOverview, getCourseTiers } from "@/features/billing/queries";
import { BillingFrame, BillingOverview } from "@/features/courses/components/billing-overview";
import { billingErrorMessage } from "@/features/courses/lib/billing-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Billing" };

interface PageProps {
  searchParams: Promise<{ reference?: string; paid?: string }>;
}

export default async function BillingOverviewPage({ searchParams }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "billing.view")) notFound();

  const [prefs, sp] = await Promise.all([getUserPreferences(viewer.user.id), searchParams]);
  const reference = typeof sp.reference === "string" && sp.reference.length <= 128 ? sp.reference : null;
  const payment = reference || sp.paid === "1" ? { reference, paid: sp.paid === "1" } : null;
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };

  try {
    const [overview, tiers] = await Promise.all([getBillingOverview(), getCourseTiers()]);
    return (
      <BillingOverview
        overview={overview}
        tiers={tiers}
        ctx={ctx}
        canManage={can(viewer, "billing.manage")}
        payment={payment}
      />
    );
  } catch (e) {
    const code = (e as { code?: string }).code;
    return (
      <BillingFrame>
        <p role="alert" className="text-muted-foreground text-sm">
          We couldn&apos;t load your billing details. {code ? billingErrorMessage(`${code}: `) : null}{" "}
          <Link href="/dashboard/settings/billing" className="text-foreground underline underline-offset-2">
            Try again
          </Link>
        </p>
      </BillingFrame>
    );
  }
}
