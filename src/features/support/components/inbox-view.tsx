/**
 * An inbox of queries (support.md): the organisation's or Nexa's. Server
 * component; filters are links, so it works without JavaScript.
 */

import Link from "next/link";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/lib/viewer";
import { ViewerError } from "@/lib/viewer";

import { listInbox } from "../support";
import { STAFF_STATUS_LABEL, SUPPORT_STATUSES, type SupportRoute, type SupportStatus } from "../support-rules";
import { QueryList } from "./query-list";

export async function InboxView({ viewer, route, status, basePath }: { viewer: Viewer; route: SupportRoute; status: string | undefined; basePath: string }) {
  const chosen: SupportStatus = (SUPPORT_STATUSES as readonly string[]).includes(status ?? "") ? (status as SupportStatus) : "OPEN";
  const title = route === "NEXA" ? "Support inbox" : "Queries";
  let data: Awaited<ReturnType<typeof listInbox>>;
  try {
    data = await listInbox(viewer, { route, status: chosen });
  } catch (e) {
    if (e instanceof ViewerError) {
      return <PageMessage breadcrumb={[{ label: title }]}>Only staff who handle queries can open this page. Ask an owner or admin for the &ldquo;Handle enquiries&rdquo; permission.</PageMessage>;
    }
    throw e;
  }

  const description = route === "NEXA"
    ? "Questions, problem reports and feedback sent to Nexa support. Newest activity first."
    : "Questions from your students and parents about classes, marks, bookings and fees. You see those for the courses you look after.";

  return (
    <PageFrame type="list" breadcrumb={[{ label: title }]} helpHref={null}>
      <PageTitle title={title} description={description} />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
        {SUPPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`${basePath}?status=${s}`}
            aria-current={s === chosen ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm", s === chosen ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            {STAFF_STATUS_LABEL[s]} <span className="tabular-nums">({data.counts[s]})</span>
          </Link>
        ))}
      </nav>
      {data.items.length ? (
        <QueryList items={data.items} side="staff" />
      ) : (
        <div className="flex min-h-[220px] items-center justify-center">
          <EmptyState
            illustration={<Scene name="empty-submissions" />}
            title={chosen === "OPEN" ? "Nothing waiting for an answer" : chosen === "ANSWERED" ? "No queries waiting on a reply from the person who asked" : "No closed queries yet"}
            description={chosen === "OPEN" ? "New queries appear here, and you get a notification for each one." : "They show here once there are some."}
          />
        </div>
      )}
    </PageFrame>
  );
}
