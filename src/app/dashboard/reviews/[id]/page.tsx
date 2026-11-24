/**
 * /dashboard/reviews/[id]: one review. The manager writes and shares it; the
 * tutor reads it and replies (viewer.md "Tutor outcomes and reviews").
 */

import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { OutcomesGrid } from "@/features/staff/components/outcomes-view";
import { AcknowledgeReview, ReviewEditor } from "@/features/staff/components/review-parts";
import type { TutorOutcomes } from "@/features/staff/outcomes-math";
import { listReviews } from "@/features/staff/outcomes";
import { schoolDateFormat } from "@/lib/datetime";
import { can, getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Review" };

const day = schoolDateFormat({ day: "numeric", month: "short", year: "numeric" });
const STATUS = { DRAFT: { label: "Draft: not shared yet", tone: "neutral" }, SHARED: { label: "Shared", tone: "warning" }, ACKNOWLEDGED: { label: "Read and replied", tone: "success" } } as const;

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=/dashboard/reviews/${id}`);
  const crumbs = [{ label: "Reviews", href: "/dashboard/reviews" }, { label: "Review" }];
  let rows: Awaited<ReturnType<typeof listReviews>>;
  try {
    rows = await listReviews(viewer, {});
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={crumbs}>Reviews are for staff of an organisation.</PageMessage>;
    throw e;
  }
  const r = rows.find((x) => x.id === id);
  if (!r) return <PageMessage breadcrumb={crumbs}>This review doesn&apos;t exist, or it hasn&apos;t been shared with you.</PageMessage>;
  const mine = r.membershipId === viewer.membership?.id;
  const canEdit = !mine && can(viewer, "staff.reviews");
  const s = STATUS[r.status as keyof typeof STATUS];
  const text = (label: string, body: string | null) => (
    <div className="flex flex-col gap-1">
      <h3 className="text-foreground text-sm font-semibold">{label}</h3>
      <p className="text-foreground text-sm whitespace-pre-wrap">{body || <span className="text-muted-foreground">Nothing written.</span>}</p>
    </div>
  );

  return (
    <PageFrame type="record" breadcrumb={[{ label: "Reviews", href: "/dashboard/reviews" }, { label: mine ? "Your review" : r.tutorName }]} status={<StatusChip tone={s.tone}>{s.label}</StatusChip>}>
      <PageTitle
        title={mine ? "Your review" : `Review: ${r.tutorName}`}
        description={`${day.format(r.periodStart)} to ${day.format(r.periodEnd)}, by ${r.reviewerName || "a manager"}.${r.status === "DRAFT" && canEdit ? " Only managers can see it until you share it." : ""}`}
      />

      <PageSection title="The figures" description="Saved when the review was started, so they don't change underneath it.">
        <OutcomesGrid outcomes={r.outcomes as unknown as TutorOutcomes} />
      </PageSection>

      <PageSection title={canEdit ? "Your review" : "What your manager wrote"}>
        {canEdit ? (
          <ReviewEditor id={r.id} status={r.status as "DRAFT" | "SHARED" | "ACKNOWLEDGED"} initial={{ strengths: r.strengths ?? "", improvements: r.improvements ?? "", goals: r.goals ?? "", rating: r.rating }} />
        ) : (
          <div className="flex flex-col gap-4">
            {text("What went well", r.strengths)}
            {text("What to work on", r.improvements)}
            {text("Goals for next period", r.goals)}
            {r.rating ? <p className="text-foreground text-sm">Overall: {r.rating} of 5</p> : null}
          </div>
        )}
      </PageSection>

      {r.status === "ACKNOWLEDGED" ? (
        <PageSection title={mine ? "Your reply" : `${r.tutorName.split(" ")[0]}'s reply`}>
          <p className="text-foreground text-sm whitespace-pre-wrap">{r.response || <span className="text-muted-foreground">Read, with no reply.</span>}</p>
        </PageSection>
      ) : mine && r.status === "SHARED" ? (
        <AcknowledgeReview id={r.id} />
      ) : null}
    </PageFrame>
  );
}
