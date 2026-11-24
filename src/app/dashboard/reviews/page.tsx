/**
 * /dashboard/reviews: staff reviews (viewer.md "Tutor outcomes and
 * reviews"). Managers see reviews for the staff they look after, drafts
 * too; everyone sees reviews shared with them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { listReviews } from "@/features/staff/outcomes";
import { schoolDateFormat } from "@/lib/datetime";
import { can, getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Reviews" };

const day = schoolDateFormat({ day: "numeric", month: "short", year: "numeric" });
const STATUS = { DRAFT: { label: "Draft", tone: "neutral" }, SHARED: { label: "Waiting for their reply", tone: "warning" }, ACKNOWLEDGED: { label: "Read and replied", tone: "success" } } as const;

export default async function ReviewsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/reviews");
  let rows: Awaited<ReturnType<typeof listReviews>>;
  try {
    rows = await listReviews(viewer, {});
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={[{ label: "Reviews" }]}>Reviews are for staff of an organisation.</PageMessage>;
    throw e;
  }
  const me = viewer.membership?.id;
  const reviewer = can(viewer, "staff.reviews");
  return (
    <PageFrame type="list" breadcrumb={[{ label: "Reviews" }]}>
      <PageTitle
        title="Reviews"
        description={reviewer ? "Reviews of the tutors you look after, and any shared with you. Start a new one from Tutor outcomes." : "Reviews your manager has shared with you. Open one to read it and reply."}
      />
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{reviewer ? <>No reviews yet. Start one from <Link href="/dashboard/outcomes" className="text-primary underline underline-offset-2">Tutor outcomes</Link>.</> : "No reviews have been shared with you yet."}</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {rows.map((r) => {
            const s = STATUS[r.status as keyof typeof STATUS];
            return (
              <li key={r.id}>
                <Link href={`/dashboard/reviews/${r.id}`} className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="text-foreground block text-sm font-medium">{r.membershipId === me ? "Your review" : r.tutorName}</span>
                    <span className="text-muted-foreground text-xs">{day.format(r.periodStart)} to {day.format(r.periodEnd)} · by {r.reviewerName || "a manager"}</span>
                  </span>
                  <StatusChip tone={s.tone}>{s.label}</StatusChip>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
