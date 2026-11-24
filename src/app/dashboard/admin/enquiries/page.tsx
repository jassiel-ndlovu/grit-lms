/**
 * /dashboard/admin/enquiries: what people sent through the contact form
 * (/contact). Nexa admins only. Newest first; filter by status.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { EnquiryRowActions } from "@/features/marketing/components/enquiry-row-actions";
import { countNewEnquiries, listEnquiries } from "@/features/marketing/enquiries";
import { whenLabel } from "@/features/support/support-ui";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Enquiries" };

const STATUSES = ["NEW", "CONTACTED", "CLOSED", "SPAM"] as const;
type Status = (typeof STATUSES)[number];
const LABEL: Record<Status, string> = { NEW: "New", CONTACTED: "Replied", CLOSED: "Done", SPAM: "Spam" };
const TONE: Record<Status, StatusTone> = { NEW: "warning", CONTACTED: "info", CLOSED: "neutral", SPAM: "danger" };
const KIND: Record<string, string> = { ACCESS: "Wants an account", TEAM: "Organisation", OTHER: "Other" };

export default async function AdminEnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/admin/enquiries");
  if (viewer.persona !== "admin") notFound();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : "NEW";
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;
  const [list, newCount] = await Promise.all([listEnquiries({ status, cursor, limit: 50 }), countNewEnquiries()]);
  const now = new Date();

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Enquiries" }]} helpHref={null}>
      <PageTitle
        title="Enquiries"
        description={`People asking for an account or about their organisation, from the contact form. ${newCount} new. Reply by email, then mark each one.`}
      />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Link key={s} href={`/dashboard/admin/enquiries?status=${s}`} aria-current={s === status ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm", s === status ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>
            {LABEL[s]}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No {LABEL[status].toLowerCase()} enquiries.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {list.items.map((e) => (
            <li key={e.id} className="grid gap-3 p-4 md:grid-cols-[1fr_16rem]">
              <div className="min-w-0">
                <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
                  {e.name}
                  <StatusChip tone={TONE[e.status as Status]}>{LABEL[e.status as Status]}</StatusChip>
                  <span className="text-muted-foreground text-xs font-normal">{KIND[e.kind] ?? e.kind} · {whenLabel(e.createdAt, now)}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  <a href={`mailto:${e.email}`} className="hover:text-foreground underline underline-offset-2">{e.email}</a>
                  {e.phone ? ` · ${e.phone}` : ""}
                  {e.organisation ? ` · ${e.organisation}` : ""}
                  {e.students != null ? ` · about ${e.students} students` : ""}
                  {e.source ? ` · from ${e.source}` : ""}
                </p>
                <p className="text-foreground mt-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{e.message}</p>
              </div>
              <EnquiryRowActions id={e.id} status={e.status as Status} note={e.note} />
            </li>
          ))}
        </ul>
      )}
      {list.nextCursor ? (
        <Link href={`/dashboard/admin/enquiries?status=${status}&cursor=${list.nextCursor}`} className="text-primary text-sm underline underline-offset-2">Older enquiries</Link>
      ) : null}
    </PageFrame>
  );
}
