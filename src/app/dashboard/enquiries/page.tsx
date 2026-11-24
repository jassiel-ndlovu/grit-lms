/**
 * /dashboard/enquiries: families asking about classes, from the online form
 * or added by staff (viewer.md "Enquiry pipeline"). Needs `enquiries.manage`.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EnquiryFormSwitch } from "@/features/crm/components/enquiry-parts";
import { crmRoutes, gradeLabel, SOURCE_LABEL, STAGE_LABEL, STAGE_ORDER, STAGE_TONE, type Stage } from "@/features/crm/crm-ui";
import { listEnquiries } from "@/features/crm/enquiries";
import { whenLabel } from "@/features/support/support-ui";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { can, getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Enquiries" };

type SP = { stage?: string; assigned?: string; due?: string; q?: string };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${crmRoutes.list}`);
  const sp = await searchParams;
  const stage = (STAGE_ORDER as readonly string[]).includes(sp.stage ?? "") ? (sp.stage as Stage) : undefined;
  const assigned = sp.assigned === "me" || sp.assigned === "none" ? sp.assigned : undefined;
  const dueOnly = sp.due === "1";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  let data: Awaited<ReturnType<typeof listEnquiries>>;
  try {
    data = await listEnquiries(viewer, { stage, assigned, dueOnly, q, limit: 200 });
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={[{ label: "Enquiries" }]}>Only staff who handle enquiries can open this page. Ask an owner or admin for the &ldquo;Handle enquiries&rdquo; permission.</PageMessage>;
    throw e;
  }

  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: viewer.workspace!.id }, select: { slug: true, enquiryFormOn: true } });
  const names = new Map(
    (await prisma.membership.findMany({ where: { id: { in: [...new Set(data.items.map((i) => i.assignedMembershipId).filter((x): x is string => !!x))] } }, select: { id: true, user: { select: { name: true } } } })).map((m) => [m.id, m.user.name]),
  );
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const href = (patch: Partial<SP>) => {
    const next = { stage, assigned, due: dueOnly ? "1" : undefined, q: q || undefined, ...patch };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
    return qs ? `${crmRoutes.list}?${qs}` : crmRoutes.list;
  };
  const now = new Date();
  const tab = (active: boolean) => cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground");

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Enquiries" }]}
      actions={<Button asChild size="sm" variant="brand"><Link href={crmRoutes.create}><Plus aria-hidden className="size-4" /> New enquiry</Link></Button>}
    >
      <PageTitle
        title="Enquiries"
        description="Families asking about classes. Move each one along as you talk to them, from New to Enrolled, so nobody is forgotten."
      />

      {can(viewer, "workspace.settings") ? <EnquiryFormSwitch on={ws.enquiryFormOn} url={`${siteUrl()}${crmRoutes.publicForm(ws.slug)}`} /> : null}

      <nav aria-label="Filter by stage" className="flex flex-wrap gap-1">
        <Link href={href({ stage: undefined })} aria-current={!stage ? "page" : undefined} className={tab(!stage)}>All <span className="tabular-nums">({total})</span></Link>
        {STAGE_ORDER.map((s) => (
          <Link key={s} href={href({ stage: s })} aria-current={stage === s ? "page" : undefined} className={tab(stage === s)}>
            {STAGE_LABEL[s]} <span className="tabular-nums">({data.counts[s]})</span>
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <form action={crmRoutes.list} className="relative w-full sm:w-72">
          {stage ? <input type="hidden" name="stage" value={stage} /> : null}
          {assigned ? <input type="hidden" name="assigned" value={assigned} /> : null}
          {dueOnly ? <input type="hidden" name="due" value="1" /> : null}
          <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input type="search" name="q" defaultValue={q} placeholder="Search names, email or phone" aria-label="Search enquiries" className="pl-9" />
        </form>
        <Link href={href({ assigned: assigned === "me" ? undefined : "me" })} className={tab(assigned === "me")}>Mine</Link>
        <Link href={href({ assigned: assigned === "none" ? undefined : "none" })} className={tab(assigned === "none")}>Nobody looking after it</Link>
        <Link href={href({ due: dueOnly ? undefined : "1" })} className={tab(dueOnly)}>Follow-up due</Link>
      </div>

      {data.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {total === 0 ? "No enquiries yet. Add one with New enquiry, or switch on the online form so families can ask." : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {data.items.map((e) => {
            const due = e.nextFollowUpAt && e.nextFollowUpAt <= now && e.stage !== "ENROLLED" && e.stage !== "LOST";
            const about = [e.studentName, gradeLabel(e.gradeLevel), e.subjects.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
            return (
              <li key={e.id}>
                <Link href={crmRoutes.one(e.id)} className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
                      {e.name}
                      <StatusChip tone={STAGE_TONE[e.stage as Stage]}>{STAGE_LABEL[e.stage as Stage]}</StatusChip>
                      {due ? <StatusChip tone="warning">Follow-up due</StatusChip> : null}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {about || "No student details yet"} · {SOURCE_LABEL[e.source] ?? e.source}
                      {e.assignedMembershipId ? ` · ${names.get(e.assignedMembershipId) ?? "Staff"}` : " · nobody looking after it"}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{whenLabel(e.createdAt, now)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
