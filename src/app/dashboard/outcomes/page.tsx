/**
 * /dashboard/outcomes: how each tutor's classes are doing over a period
 * (viewer.md "Tutor outcomes and reviews"). Managers with `staff.reviews`
 * or `reports.view` see the tutors they look after; anyone else sees their
 * own.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { OutcomesGrid, outcomeRows } from "@/features/staff/components/outcomes-view";
import { StartReview } from "@/features/staff/components/review-parts";
import { listTutorOutcomes } from "@/features/staff/outcomes";
import { cn } from "@/lib/utils";
import { can, getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Tutor outcomes" };

const RANGES = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last 12 months", days: 365 },
] as const;

export default async function OutcomesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/outcomes");
  const { range } = await searchParams;
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];
  const to = new Date();
  const from = new Date(to.getTime() - r.days * 86_400_000);
  const crumbs = [{ label: "Tutor outcomes" }];

  let rows: Awaited<ReturnType<typeof listTutorOutcomes>>;
  try {
    rows = await listTutorOutcomes(viewer, { from, to });
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={crumbs}>Tutor outcomes are for staff of an organisation.</PageMessage>;
    throw e;
  }
  const manager = can(viewer, "staff.reviews") || can(viewer, "reports.view");
  const reviewer = can(viewer, "staff.reviews");
  const me = viewer.membership?.id;

  return (
    <PageFrame type="list" breadcrumb={crumbs}>
      <PageTitle
        title="Tutor outcomes"
        description={manager
          ? "How each tutor's classes are doing: marks, hand-ins, attendance and more. Use it to support tutors and as the starting point for a review."
          : "How your classes are doing: marks, hand-ins, attendance and more."}
      />
      <nav aria-label="Period" className="flex flex-wrap gap-1">
        {RANGES.map((x) => (
          <Link key={x.key} href={`/dashboard/outcomes?range=${x.key}`} aria-current={x.key === r.key ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm", x.key === r.key ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>
            {x.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tutors with courses to show for this period.</p>
      ) : rows.length === 1 && !manager ? (
        <OutcomesGrid outcomes={rows[0].outcomes} />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="py-2 pr-3 font-medium">Tutor</th>
                {outcomeRows(rows[0].outcomes).slice(1, 7).map((c) => <th key={c.label} className="py-2 pr-3 font-medium">{c.label}</th>)}
                {reviewer ? <th className="py-2 font-medium"><span className="sr-only">Review</span></th> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((row) => (
                <tr key={row.membershipId}>
                  <th scope="row" className="text-foreground py-2 pr-3 text-left font-medium">{row.name}</th>
                  {outcomeRows(row.outcomes).slice(1, 7).map((c) => <td key={c.label} className="py-2 pr-3 tabular-nums">{c.value}</td>)}
                  {reviewer ? (
                    <td className="py-2 text-right">
                      {row.membershipId !== me ? <StartReview membershipId={row.membershipId} name={row.name} from={from.toISOString()} to={to.toISOString()} /> : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PageSection title="Reviews">
        <p className="text-muted-foreground text-sm">
          {reviewer ? "Start a review from a tutor's row: it saves these figures with it. " : ""}
          <Link href="/dashboard/reviews" className="text-primary underline underline-offset-2">{reviewer ? "See all reviews" : "See your reviews"}</Link>
        </p>
      </PageSection>
    </PageFrame>
  );
}
