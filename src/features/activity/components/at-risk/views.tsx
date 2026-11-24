/**
 * At-risk alerts: the staff list, its course filter and empty states, and
 * "Notes from your tutors" for students and parents.
 */

import Link from "next/link";
import { CalendarX2, FileX2, TrendingDown, TriangleAlert, type LucideIcon } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { TonePanel } from "@/components/ui/nexus";
import type { SharedRiskAlert } from "@/features/risk/alerts";
import type { RiskReason } from "@/features/risk/rules";
import { formatDate, type DateContext } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import type { AlertRow } from "../../at-risk";
import { atRiskRoutes, CLOSED_LABEL, LEVEL_CHIP, REASON_LABEL, reasonRules, sharedWithLabel, type AlertView } from "../../lib/at-risk";
import { CloseAlertButton, ShareAlertButton } from "./alert-actions";

const REASON_ICON: Record<RiskReason["rule"], LucideIcon> = {
  FALLING_MARKS: TrendingDown,
  LOW_MARKS: TriangleAlert,
  MISSED_WORK: FileX2,
  ABSENCES: CalendarX2,
};

const day = (d: Date, ctx: DateContext) => formatDate(d, ctx, { day: "numeric", month: "short" });

export function AlertCourseFilter({
  view, courses, current, total,
}: {
  view: AlertView;
  courses: { id: string; name: string; count: number }[];
  current: string | null;
  total: number;
}) {
  if (courses.length < 2 && !current) return null;
  const links = [{ id: null as string | null, name: "All courses", count: total }, ...courses];
  return (
    <nav aria-label="Course" className="flex flex-wrap gap-1">
      {links.map((c) => (
        <Link
          key={c.id ?? "all"}
          href={atRiskRoutes.view(view, c.id)}
          aria-current={c.id === current ? "true" : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            c.id === current ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {c.name}
          <span className="tabular-nums">{c.count}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AlertList({ rows, ctx }: { rows: AlertRow[]; ctx: DateContext }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {rows.map((a) => {
        const open = a.closedAt === null;
        const shared = sharedWithLabel(a.sharedWith);
        return (
          <li
            key={a.id}
            data-slot="tone-row"
            data-tone={open ? (LEVEL_CHIP[a.level].tone === "danger" ? "danger" : "warning") : "neutral"}
            className="space-y-3 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-foreground font-medium">{a.student.name}</h2>
                <p className="text-muted-foreground text-xs">
                  {a.course.name} · since {day(a.firstSeenAt, ctx)}
                  {a.closedAt ? ` · closed ${day(a.closedAt, ctx)}` : ""}
                </p>
              </div>
              {open ? (
                <StatusChip tone={LEVEL_CHIP[a.level].tone}>{LEVEL_CHIP[a.level].label}</StatusChip>
              ) : (
                <StatusChip tone="neutral">{CLOSED_LABEL[a.status] ?? "Closed"}</StatusChip>
              )}
            </div>

            <p className="text-foreground max-w-prose text-sm">{a.summary}</p>

            <ul className="flex flex-wrap gap-1.5" aria-label="Reasons">
              {reasonRules(a.reasons).map((rule) => {
                const Icon = REASON_ICON[rule];
                return (
                  <li key={rule}>
                    <Badge variant="secondary" className="gap-1">
                      <Icon aria-hidden className="size-3" />
                      {REASON_LABEL[rule]}
                    </Badge>
                  </li>
                );
              })}
            </ul>

            {shared && a.sharedAt ? (
              <div className="bg-muted/60 max-w-prose space-y-1 rounded-md px-3 py-2 text-sm">
                <p className="text-muted-foreground text-xs">
                  Shared with {shared} on {day(a.sharedAt, ctx)}
                </p>
                {a.shareNote ? <p className="text-foreground whitespace-pre-line">{a.shareNote}</p> : null}
              </div>
            ) : null}

            {open ? (
              <div className="flex flex-wrap items-center gap-2">
                {a.share === "yes" ? (
                  <ShareAlertButton alertId={a.id} studentName={a.student.name} summary={a.summary} to={a.canShareWith} again={a.sharedAt !== null} />
                ) : a.share === "plan" ? (
                  <p className="text-muted-foreground order-last basis-full text-xs">Sharing is part of Pro, which is off for this course.</p>
                ) : null}
                <CloseAlertButton alertId={a.id} studentName={a.student.name} kind="sorted" />
                <CloseAlertButton alertId={a.id} studentName={a.student.name} kind="dismiss" />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function NoAlerts({ view, switchedOn }: { view: AlertView; switchedOn: boolean }) {
  if (!switchedOn && view === "open") {
    return (
      <EmptyState
        illustration={<Scene name="empty-courses" />}
        title="At-risk alerts are part of Pro"
        description="Switch them on in a course's Services. Nexa then checks that course's marks, missed work and attendance each day."
      />
    );
  }
  return view === "open" ? (
    <EmptyState
      illustration={<Scene name="nothing-to-grade" />}
      title="No open alerts"
      description="Nexa checks marks, missed work and attendance each day. Students who may need help show up here."
    />
  ) : (
    <EmptyState illustration={<Scene name="inbox-empty" />} title="No closed alerts" description="Alerts you close, and ones that clear up by themselves, show up here." />
  );
}

/** Students and parents: what staff shared with them. Nothing when there is nothing. */
export function FamilyNotes({ notes, ctx, withStudent = false }: { notes: SharedRiskAlert[]; ctx: DateContext; /** Name the child, for a parent with several. */ withStudent?: boolean }) {
  if (notes.length === 0) return null;
  return (
    <section className="space-y-4" aria-labelledby="tutor-notes">
      <h2 id="tutor-notes" className="text-foreground text-base font-semibold">
        Notes from your tutors
      </h2>
      <TonePanel tone="accent" className="p-0">
        <ul className="divide-border divide-y">
          {notes.map((n) => (
            <li key={n.id} className="space-y-2 px-4 py-4 sm:px-5">
              <div>
                <p className="text-foreground text-sm font-medium">{withStudent ? `${n.student.name} · ${n.course.name}` : n.course.name}</p>
                <p className="text-muted-foreground text-xs">
                  {n.sharedBy ? `From ${n.sharedBy}, ` : ""}
                  {day(n.sharedAt, ctx)}
                </p>
              </div>
              {n.note ? <p className="text-foreground max-w-prose text-sm whitespace-pre-line">{n.note}</p> : null}
              <p className="text-muted-foreground max-w-prose text-sm">{n.summary}</p>
            </li>
          ))}
        </ul>
      </TonePanel>
    </section>
  );
}
