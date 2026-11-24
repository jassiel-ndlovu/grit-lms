/**
 * A list of queries: the requester's own, or an inbox (support.md). Server
 * component; rows link to the thread.
 */

import Link from "next/link";

import { StatusChip } from "@/components/shell/status-chip";

import { STAFF_STATUS_LABEL, STATUS_LABEL, TOPIC_LABEL } from "../support-rules";
import type { QueryListItem } from "../support";
import { routeLabel, STATUS_TONE, supportRoutes, whenLabel } from "../support-ui";

export function QueryList({ items, side, now = new Date() }: { items: QueryListItem[]; side: "requester" | "staff"; now?: Date }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {items.map((q) => (
        <li key={q.id}>
          <Link href={supportRoutes.query(q.id)} className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-foreground flex items-center gap-2 text-sm font-medium">
                {q.unread ? <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="New reply" /> : null}
                <span className="truncate">{q.subject}</span>
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {q.ref} · {TOPIC_LABEL[q.topic]}
                {side === "staff" ? ` · ${q.requesterName}${q.requesterPersona === "guardian" ? " (parent)" : q.requesterPersona === "learner" ? " (student)" : q.requesterPersona === "public" ? " (not signed in)" : ""}` : ` · ${routeLabel(q.route, q.organisationName)}`}
                {q.courseName ? ` · ${q.courseName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusChip tone={STATUS_TONE[q.status]}>{side === "staff" ? STAFF_STATUS_LABEL[q.status] : STATUS_LABEL[q.status]}</StatusChip>
              <span className="text-muted-foreground w-28 text-right text-xs tabular-nums">{whenLabel(q.lastActivityAt, now)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
