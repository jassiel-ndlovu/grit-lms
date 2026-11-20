/**
 * /dashboard/settings/billing/usage — usage per billing period
 * (a/ux/03-billing.md §3). `?period=` picks an earlier period by its start;
 * the choices are the periods of paid invoices. Every number comes from
 * A's getUsage (billing.md 1.6).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { getBillingOverview, getUsage, listPlatformInvoices } from "@/features/billing/queries";
import { requireBillingPage } from "@/features/courses/billing-page";
import { BillingFrame, billingRoutes } from "@/features/courses/components/billing-overview";
import { BillingUsage } from "@/features/courses/components/billing-usage";
import { USAGE_METERS, billingErrorMessage } from "@/features/courses/lib/billing-ui";

export const metadata = { title: "Usage · Billing" };

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function BillingUsagePage({ searchParams }: PageProps) {
  const { ctx, canManage } = await requireBillingPage();
  const sp = await searchParams;

  try {
    const [overview, invoices] = await Promise.all([getBillingOverview(), listPlatformInvoices({ limit: 12 })]);
    const periods = [...new Set(invoices.items.filter((i) => i.status === "PAID").map((i) => i.periodStart))];
    // Only a period from the list: anything else is a stale or made-up link.
    const periodStart = typeof sp.period === "string" && periods.includes(sp.period) ? sp.period : null;
    if (sp.period && !periodStart) notFound();
    // The current period is offered by "Current"; list only the earlier ones.
    const current = overview.period?.start ?? null;
    const earlier = periods.filter((p) => p !== current);

    const usage = await Promise.all(
      USAGE_METERS.map((m) => getUsage({ meter: m.meter, ...(periodStart ? { periodStart } : {}) })),
    );
    return (
      <BillingFrame page={[{ label: "Usage" }]} title="Usage">
        <BillingUsage
          usage={usage}
          trial={overview.state === "TRIAL" && !periodStart}
          ctx={ctx}
          periods={earlier}
          periodStart={periodStart === current ? null : periodStart}
          canManage={canManage}
        />
      </BillingFrame>
    );
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_")) throw e;
    const code = (e as { code?: string }).code;
    return (
      <BillingFrame page={[{ label: "Usage" }]} title="Usage">
        <p role="alert" className="text-muted-foreground text-sm">
          We couldn&apos;t load your usage. {code ? billingErrorMessage(`${code}: `) : null}{" "}
          <Link href={billingRoutes.usage} className="text-foreground underline underline-offset-2">
            Try again
          </Link>
        </p>
      </BillingFrame>
    );
  }
}
