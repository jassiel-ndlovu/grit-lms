/**
 * /dashboard/fees/discounts — discount codes on parents' fees (a/ux/05,
 * section 3): the workspace's codes (listFeeDiscountCodes) with Turn off,
 * and a new code. Owners and admins only (`fees.manage` without a scope),
 * since the discount comes out of every payee's share. Behind BILLING=1.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { isBillingEnabled } from "@/features/billing/errors";
import { FeeCodeForm, FeeCodeList } from "@/features/courses/components/fee-discount-codes";
import { payoutErrorMessage } from "@/features/courses/lib/payouts-ui";
import { listFeeDiscountCodes } from "@/features/payments/fee-queries";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";
import { needsScope } from "@/lib/viewer-core";

export const metadata = { title: "Discount codes · Fees" };

export default async function FeeDiscountsPage() {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "fees.manage") || needsScope(viewer, "fees.manage")) notFound();

  const prefs = await getUserPreferences(viewer.user.id);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };

  let codes;
  let failed: string | null = null;
  try {
    codes = await listFeeDiscountCodes();
  } catch (e) {
    const code = (e as { code?: string }).code;
    failed = code ? payoutErrorMessage(`${code}: ${(e as { message?: string }).message ?? ""}`) : "";
  }

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Fees", href: "/dashboard/fees" }, { label: "Discount codes" }]}>
      <PageTitle
        title="Discount codes"
        description={
          <>
            Parents enter a code when they pay your fees online. It takes money off fees in this organisation only, and each
            student can use it once per payment.
          </>
        }
      />

      <section aria-labelledby="codes-heading" className="space-y-4">
        <h2 id="codes-heading" className="text-foreground text-sm font-semibold">
          Codes
        </h2>
        {codes ? (
          <FeeCodeList codes={codes} ctx={ctx} now={new Date().toISOString()} />
        ) : (
          <p role="alert" className="text-muted-foreground text-sm">
            We couldn&apos;t load your codes. {failed}{" "}
            <Link href="/dashboard/fees/discounts" className="text-foreground underline underline-offset-2">
              Try again
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="new-code-heading" className="space-y-4">
        <h2 id="new-code-heading" className="text-foreground text-sm font-semibold">
          New code
        </h2>
        <FeeCodeForm />
      </section>
    </PageFrame>
  );
}
