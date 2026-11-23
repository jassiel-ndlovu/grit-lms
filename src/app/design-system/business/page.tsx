/**
 * /design-system/business — the business dashboard with sample data and no
 * session: an organisation, a branch role, and a new workspace with billing
 * off. Same gate as /design-system.
 */

import { notFound } from "next/navigation";
import { ChartPie } from "lucide-react";

import { BusinessDashboard, PeriodPicker, type BusinessData } from "@/components/business/dashboard";
import { dayIn, resolvePeriod } from "@/components/business/period";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Business · Design system", robots: { index: false } };

const ctx = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const NOW = new Date("2026-11-23T10:00:00Z");

const ORGANISATION: BusinessData = {
  period: { from: "2026-10-24T22:00:00.000Z", to: NOW.toISOString() },
  scope: null,
  currency: "ZAR",
  money: {
    invoicedCents: 18_420_000,
    collectedCents: 15_265_050,
    collectedOffsiteCents: 1_240_000,
    refundedCents: 85_000,
    collectionRateBps: 8640,
    overdue: { invoices: 9, cents: 1_830_000, oldestDueAt: "2026-10-03T22:00:00.000Z" },
    dueNext7Days: { invoices: 14, cents: 2_660_000 },
  },
  students: { active: 128, joined: 17, left: 6, courses: 14 },
  trend: [
    { month: "2026-06", collectedCents: 9_800_000, newStudents: 8 },
    { month: "2026-07", collectedCents: 11_250_000, newStudents: 12 },
    { month: "2026-08", collectedCents: 12_900_000, newStudents: 10 },
    { month: "2026-09", collectedCents: 12_100_000, newStudents: 4 },
    { month: "2026-10", collectedCents: 16_750_000, newStudents: 19 },
    { month: "2026-11", collectedCents: 11_400_000, newStudents: 11 },
  ],
  tutors: [
    { membershipId: "m1", name: "Ayanda Zulu", courses: 5, activeStudents: 61, invoicedCents: 8_110_000, collectedCents: 7_020_000, overdueCents: 640_000 },
    { membershipId: "m2", name: "Bongani Nkosi", courses: 6, activeStudents: 48, invoicedCents: 6_900_000, collectedCents: 5_400_000, overdueCents: 1_190_000 },
    { membershipId: "m3", name: "Johanna van der Westhuizen-Mokoena", courses: 3, activeStudents: 24, invoicedCents: 3_410_000, collectedCents: 2_845_050, overdueCents: 0 },
  ],
  aiCreditsUsed: 412,
  notes: [],
  generatedAt: NOW.toISOString(),
};

const BRANCH: BusinessData = {
  ...ORGANISATION,
  scope: { branchIds: ["b1"] },
  money: { ...ORGANISATION.money, invoicedCents: 6_900_000, collectedCents: 5_400_000, collectedOffsiteCents: 0, refundedCents: 0, collectionRateBps: null, overdue: { invoices: 0, cents: 0, oldestDueAt: null }, dueNext7Days: { invoices: 1, cents: 13_900 } },
  students: { active: 48, joined: 1, left: 0, courses: 6 },
  tutors: ORGANISATION.tutors.slice(1, 2),
  aiCreditsUsed: null,
  notes: ["Branch figures come from invoice lines on the branch's courses, before invoice-level discounts. Refunds and AI credits show on the whole-organisation view."],
};

const NEW: BusinessData = {
  ...ORGANISATION,
  students: { active: 0, joined: 0, left: 0, courses: 1 },
  trend: ORGANISATION.trend.map((t) => ({ ...t, collectedCents: 0, newStudents: 0 })),
  tutors: [],
  aiCreditsUsed: 0,
};

export default function BusinessPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  const month = resolvePeriod({}, ctx.timeZone, NOW);
  const custom = resolvePeriod({ from: "2026-11-01", to: "2026-11-01" }, ctx.timeZone, NOW);
  const wrong = resolvePeriod({ from: "2026-11-10", to: "2026-11-01" }, ctx.timeZone, NOW);
  const today = dayIn(NOW, ctx.timeZone);

  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageFrame type="list" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Business" }]}>
        <PageTitle icon={<ChartPie />} title="Business" description="Fees and students across your workspace." />
        <PeriodPicker period={month} today={today} />
        <BusinessDashboard data={ORGANISATION} period={month} ctx={ctx} showMoney showTutors feesHref="#" />
      </PageFrame>
      <PageFrame type="list" breadcrumb={[{ label: "A branch role, one day" }]}>
        <BusinessDashboard data={BRANCH} period={custom} ctx={ctx} showMoney showTutors feesHref={null} />
      </PageFrame>
      <PageFrame type="list" breadcrumb={[{ label: "A new workspace, billing off, dates the wrong way round" }]}>
        {wrong.error ? <p className="text-destructive text-sm">{wrong.error}</p> : null}
        <BusinessDashboard data={NEW} period={wrong} ctx={ctx} showMoney={false} showTutors feesHref={null} />
      </PageFrame>
    </div>
  );
}
