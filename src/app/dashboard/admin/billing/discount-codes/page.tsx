/**
 * /dashboard/admin/billing/discount-codes — Nexa discount codes: the list
 * with how often each was used and Turn off (adminListDiscountCodes,
 * adminDeactivateDiscountCode), and the form for a new one
 * (adminCreateDiscountCode). `?show=active|off` and `?cursor=` page it.
 */

import Link from "next/link";

import { adminListDiscountCodes } from "@/features/admin/billing-queries";
import { requireAdminBillingPage } from "@/features/courses/billing-page";
import { AdminBillingFrame, adminBillingRoutes } from "@/features/courses/components/admin-billing";
import { DiscountCodeTable } from "@/features/courses/components/admin-billing-detail";
import { DiscountCodeForm } from "@/features/courses/components/admin-discount-code-form";

export const metadata = { title: "Discount codes · Billing admin" };

const SHOW = { all: "All", active: "On", off: "Off" } as const;
type Show = keyof typeof SHOW;

interface PageProps {
  searchParams: Promise<{ show?: string; cursor?: string }>;
}

export default async function AdminDiscountCodesPage({ searchParams }: PageProps) {
  const { ctx, canOverride } = await requireAdminBillingPage();
  const sp = await searchParams;
  const show: Show = sp.show === "active" || sp.show === "off" ? sp.show : "all";
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;
  const list = await adminListDiscountCodes({
    ...(show === "all" ? {} : { active: show === "active" }),
    ...(cursor ? { cursor } : {}),
    limit: 50,
  });
  const href = (p: { show?: Show; cursor?: string }) => {
    const q = new URLSearchParams();
    if (p.show && p.show !== "all") q.set("show", p.show);
    if (p.cursor) q.set("cursor", p.cursor);
    const s = q.toString();
    return s ? `${adminBillingRoutes.discountCodes}?${s}` : adminBillingRoutes.discountCodes;
  };
  // Rendered per request, so "Live" and "Ended" are as of now.
  const now = new Date().toISOString();

  return (
    <AdminBillingFrame page={[{ label: "Discount codes" }]} title="Discount codes">
      <section aria-labelledby="codes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="codes" className="text-foreground text-sm font-semibold">
            Codes
          </h2>
          <nav aria-label="Show codes" className="flex gap-1 text-sm">
            {(Object.keys(SHOW) as Show[]).map((k) => (
              <Link
                key={k}
                href={href({ show: k })}
                aria-current={k === show ? "page" : undefined}
                className={
                  k === show
                    ? "bg-muted text-foreground rounded-md px-3 py-1.5 font-medium"
                    : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
                }
              >
                {SHOW[k]}
              </Link>
            ))}
          </nav>
        </div>
        <DiscountCodeTable
          list={list}
          ctx={ctx}
          canOverride={canOverride}
          now={now}
          olderHref={list.nextCursor ? href({ show, cursor: list.nextCursor }) : null}
          newestHref={cursor ? href({ show }) : null}
        />
      </section>
      {canOverride ? (
        <section aria-labelledby="new-code" className="space-y-4">
          <h2 id="new-code" className="text-foreground text-sm font-semibold">
            New code
          </h2>
          <DiscountCodeForm />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Creating and turning off codes needs the admin override permission.</p>
      )}
    </AdminBillingFrame>
  );
}
