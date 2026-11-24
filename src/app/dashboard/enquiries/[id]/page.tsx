/**
 * /dashboard/enquiries/[id]: one enquiry. Its details, stage, notes and
 * emails, and the follow-up (viewer.md "Enquiry pipeline").
 */

import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { EditEnquiry, NoteAndEmail, StageControl } from "@/features/crm/components/enquiry-parts";
import { enquiryChoices } from "@/features/crm/crm-page-data";
import { crmRoutes, gradeLabel, SOURCE_LABEL, STAGE_LABEL, STAGE_TONE, type Stage } from "@/features/crm/crm-ui";
import { getEnquiry } from "@/features/crm/enquiries";
import { whenLabel } from "@/features/support/support-ui";
import { schoolDateFormat } from "@/lib/datetime";
import { UserError } from "@/lib/user-error";
import { getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Enquiry" };

const day = schoolDateFormat({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const stageWords = (body: string) => body.replace(/\b(NEW|CONTACTED|TRIAL|ENROLLED|LOST)\b/g, (s) => STAGE_LABEL[s as Stage]);

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${crmRoutes.one(id)}`);
  const crumbs = [{ label: "Enquiries", href: crmRoutes.list }, { label: "Enquiry" }];
  let e: Awaited<ReturnType<typeof getEnquiry>>;
  try {
    e = await getEnquiry(viewer, { id });
  } catch (err) {
    if (err instanceof ViewerError || err instanceof UserError) return <PageMessage breadcrumb={crumbs}>This enquiry doesn&apos;t exist any more, or it isn&apos;t one you look after.</PageMessage>;
    throw err;
  }
  const choices = await enquiryChoices(e.workspaceId);
  const assigned = choices.staff.find((s) => s.membershipId === e.assignedMembershipId)?.name ?? null;
  const branch = choices.branches.find((b) => b.id === e.branchId)?.name ?? null;
  const now = new Date();
  const stage = e.stage as Stage;
  const rows: Array<[string, React.ReactNode]> = [
    ["Email", e.email ? <a href={`mailto:${e.email}`} className="text-primary underline underline-offset-2">{e.email}</a> : null],
    ["Phone", e.phone ? <a href={`tel:${e.phone.replace(/\s+/g, "")}`} className="text-primary underline underline-offset-2">{e.phone}</a> : null],
    ["Student", [e.studentName, gradeLabel(e.gradeLevel)].filter(Boolean).join(", ") || null],
    ["Subjects", e.subjects.length ? e.subjects.join(", ") : null],
    ["How they found you", SOURCE_LABEL[e.source] ?? e.source],
    ["Branch", branch],
    ["Looked after by", assigned ?? "Nobody yet"],
    ["Follow up on", e.nextFollowUpAt ? day.format(e.nextFollowUpAt) : "Not set"],
    ["Received", whenLabel(e.createdAt, now)],
  ];

  return (
    <PageFrame type="record" breadcrumb={[{ label: "Enquiries", href: crmRoutes.list }, { label: e.name }]} status={<StatusChip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</StatusChip>}>
      <PageTitle title={e.name} description={e.stage === "LOST" && e.lostReason ? `Didn't join: ${e.lostReason}` : undefined} />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {e.message ? (
            <section aria-labelledby="msg-h" className="flex flex-col gap-1">
              <h2 id="msg-h" className="text-foreground text-sm font-semibold">What they asked</h2>
              <p className="text-foreground text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{e.message}</p>
            </section>
          ) : null}

          <NoteAndEmail id={e.id} email={e.email} name={e.name} workspaceName={viewer.workspace?.name ?? "us"} />

          <section aria-labelledby="hist-h" className="flex flex-col gap-2">
            <h2 id="hist-h" className="text-foreground text-sm font-semibold">History</h2>
            {e.notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No notes yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {[...e.notes].reverse().map((n) => (
                  <li key={n.id} className="border-border rounded-md border p-3 text-sm">
                    <p className="text-muted-foreground mb-1 text-xs">
                      {n.kind === "EMAIL" ? "Email sent" : n.kind === "STAGE" ? "Stage changed" : "Note"} · {n.author ?? "Someone"} · {whenLabel(n.createdAt, now)}
                    </p>
                    <p className="text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{n.kind === "STAGE" ? stageWords(n.body) : n.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <StageControl id={e.id} stage={stage} />
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground min-w-0 [overflow-wrap:anywhere]">{v ?? <span className="text-muted-foreground">Not given</span>}</dd>
              </div>
            ))}
          </dl>
          <EditEnquiry
            branches={choices.branches}
            staff={choices.staff}
            initial={{
              id: e.id, name: e.name, email: e.email, phone: e.phone, studentName: e.studentName, gradeLevel: e.gradeLevel, subjects: e.subjects,
              message: e.message, source: e.source, branchId: e.branchId, assignedMembershipId: e.assignedMembershipId,
              nextFollowUpAt: e.nextFollowUpAt ? isoDay(e.nextFollowUpAt) : null,
            }}
          />
        </aside>
      </div>
    </PageFrame>
  );
}
