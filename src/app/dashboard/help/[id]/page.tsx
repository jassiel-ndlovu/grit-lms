/**
 * /dashboard/help/[id]: one query's conversation (support.md), for the person
 * who asked or for the staff who answer it.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { TonePanel } from "@/components/ui/nexus";
import { QueryThread } from "@/features/support/components/query-thread";
import { KIND_LABEL, STAFF_STATUS_LABEL, STATUS_LABEL, TOPIC_LABEL, type SupportKind } from "@/features/support/support-rules";
import { getQuery } from "@/features/support/support";
import { routeLabel, STATUS_TONE, supportRoutes, whenLabel } from "@/features/support/support-ui";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Query" };

export default async function QueryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer) redirect(`/auth?callbackUrl=${encodeURIComponent(supportRoutes.query(id))}`);
  const { sent } = await searchParams;

  let q: Awaited<ReturnType<typeof getQuery>>;
  try {
    q = await getQuery(viewer, id);
  } catch (e) {
    if (e instanceof ViewerError || e instanceof UserError) {
      return (
        <PageMessage breadcrumb={[{ label: "Help", href: supportRoutes.help }, { label: "Query" }]}>
          You can&apos;t open this query. It may belong to someone else, or it was moved to another inbox.
        </PageMessage>
      );
    }
    throw e;
  }

  const staffSide = q.viewerIs !== "requester";
  const back = staffSide ? (q.viewerIs === "nexa" ? { label: "Support inbox", href: supportRoutes.nexaInbox } : { label: "Queries", href: supportRoutes.organisationInbox }) : { label: "Help", href: supportRoutes.help };
  // A Nexa admin can hand a query to the organisation it came from.
  const handTo = q.viewerIs === "nexa" && q.route === "NEXA"
    ? await prisma.supportQuery.findUnique({ where: { id }, select: { workspace: { select: { id: true, name: true } } } }).then((r) => r?.workspace ?? null)
    : null;
  const now = new Date();
  const details = [
    KIND_LABEL[q.kind as SupportKind],
    TOPIC_LABEL[q.topic],
    q.courseName,
    staffSide ? `From ${q.requesterName}${q.requesterEmail ? ` (${q.requesterEmail})` : ""}` : `Answered by ${routeLabel(q.route, q.organisationName)}`,
    `Sent ${whenLabel(q.createdAt, now)}`,
  ].filter(Boolean);

  return (
    <PageFrame
      type="record"
      breadcrumb={[back, { label: q.ref }]}
      status={<StatusChip tone={STATUS_TONE[q.status]}>{staffSide ? STAFF_STATUS_LABEL[q.status] : STATUS_LABEL[q.status]}</StatusChip>}
      helpHref={null}
    >
      <PageTitle title={q.subject} description={details.join(" · ")} />

      {sent && !staffSide ? (
        <TonePanel tone="success" role="status">
          <p className="text-sm">
            Sent. Your reference is <strong>{q.ref}</strong>. {q.route === "NEXA" ? "Nexa support usually answers within one working day." : `${routeLabel(q.route, q.organisationName)} has been told.`} You&apos;ll get a notification when they reply.
          </p>
        </TonePanel>
      ) : null}

      {staffSide && (q.pagePath || q.userAgent) ? (
        <p className="text-muted-foreground text-xs">
          {q.pagePath ? <>Sent from <code className="text-foreground">{q.pagePath}</code>. </> : null}
          {q.userAgent ? <>Browser: {q.userAgent.slice(0, 120)}</> : null}
        </p>
      ) : null}

      <QueryThread
        id={q.id}
        status={q.status}
        route={q.route}
        helpful={q.helpful}
        side={q.viewerIs}
        handTo={handTo}
        answererName={q.requesterName.split(" ")[0] || q.requesterName}
        messages={q.messages.map((m) => ({ ...m, whenLabel: whenLabel(m.createdAt, now) }))}
      />
    </PageFrame>
  );
}
