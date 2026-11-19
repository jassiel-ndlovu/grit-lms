/**
 * Tutor home (UI draft "Main", navigation.md "Tutor home"): a greeting and
 * a one-line summary, "Needs your attention" (to mark, due this week,
 * drafts) with filters, this week's numbers and the next sessions.
 *
 * Server component. The billing rows and the setup checklist in the draft
 * wait for Phase 2 billing and the onboarding wizard.
 */

import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { assignmentRoutes } from "@/features/assignments/routes";
import { formatDate, greetingFor } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import { filterRows, type AttentionBucket, type AttentionFilter, type AttentionRow } from "../lib/attention";
import type { TutorHomeData } from "../tutor-home";
import { NewMenu } from "./new-menu";

interface DateCtx {
  timeZone: string;
  locale: string;
}

const CHIP: Record<AttentionBucket, { label: string; tone: StatusTone }> = {
  mark: { label: "To mark", tone: "warning" },
  due: { label: "Due", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
};

const FILTERS: { value: AttentionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mark", label: "To mark" },
  { value: "due", label: "Due" },
  { value: "draft", label: "Drafts" },
];

function rowHref(r: AttentionRow): string {
  if (r.kind === "test") {
    return r.bucket === "draft" ? `/dashboard/tutor-tests/${r.id}/edit` : `/dashboard/tutor-tests/${r.id}/submissions`;
  }
  return r.bucket === "draft" ? assignmentRoutes.edit(r.id) : assignmentRoutes.detail(r.id);
}

function rowDetail(r: AttentionRow): string {
  const what = r.kind === "test" ? "Test" : "Assignment";
  if (r.bucket !== "mark") return what;
  const unit = r.kind === "test" ? "script" : "hand-in";
  return `${what} · ${r.toMark} ${unit}${r.toMark === 1 ? "" : "s"}`;
}

function dayKey(d: Date, ctx: DateCtx) {
  return formatDate(d, ctx, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function dueLabel(d: Date, now: Date, ctx: DateCtx): string {
  const day = dayKey(d, ctx);
  if (day === dayKey(now, ctx)) return "Today";
  if (day === dayKey(new Date(now.getTime() + 86_400_000), ctx)) return "Tomorrow";
  return formatDate(d, ctx, { weekday: "short", day: "numeric", month: "short" });
}

function summary(stats: TutorHomeData["stats"]): string {
  const parts: string[] = [];
  if (stats.toMark) parts.push(`${stats.toMark} to mark`);
  if (stats.dueThisWeek) parts.push(`${stats.dueThisWeek} due this week`);
  return parts.length ? parts.join(" · ") : "Nothing needs you right now";
}

export function TutorHome({
  firstName,
  data,
  filter,
  now,
  dateCtx,
}: {
  firstName: string;
  data: TutorHomeData;
  filter: AttentionFilter;
  now: Date;
  dateCtx: DateCtx;
}) {
  const rows = filterRows(data.rows, filter);
  const today = formatDate(now, dateCtx, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Home" }]}
        actions={
          <NewMenu
            items={[
              { label: "Course", href: "/dashboard/manage-courses", icon: "course" },
              { label: "Test", href: "/dashboard/tutor-tests/new", icon: "test" },
              { label: "Assignment", href: assignmentRoutes.new, icon: "assignment" },
              { label: "Event", href: "/dashboard/calendar", icon: "event" },
            ]}
          />
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <header>
          <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">
            {greetingFor(now, dateCtx.timeZone)}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {today} · {summary(data.stats)}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <section aria-labelledby="attention-heading" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="attention-heading" className="text-foreground text-base font-semibold">
                Needs your attention
              </h2>
              <nav aria-label="Filter" className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.value}
                    href={f.value === "all" ? "/dashboard" : `/dashboard?show=${f.value}`}
                    aria-current={filter === f.value ? "true" : undefined}
                    scroll={false}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-xs leading-7 font-medium transition-colors",
                      filter === f.value
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </nav>
            </div>

            <Card className="overflow-hidden p-0">
              {rows.length === 0 ? (
                <EmptyState
                  compact
                  illustration={<Scene name="nothing-to-grade" />}
                  title={filter === "all" ? "You're all caught up" : `Nothing ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}`}
                  description="Hand-ins to mark, work due this week and drafts show up here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-left text-xs">
                        <th scope="col" className="h-9 px-4 font-medium">Item</th>
                        <th scope="col" className="hidden h-9 px-4 font-medium sm:table-cell">Course</th>
                        <th scope="col" className="h-9 px-4 font-medium">Status</th>
                        <th scope="col" className="h-9 px-4 text-right font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.kind}-${r.id}`} className="border-border hover:bg-muted/40 border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <Link href={rowHref(r)} className="text-foreground font-medium hover:underline">
                              {r.title}
                            </Link>
                            <p className="text-muted-foreground text-xs">
                              {rowDetail(r)}
                              <span className="sm:hidden"> · {r.course}</span>
                            </p>
                          </td>
                          <td className="text-muted-foreground hidden max-w-40 truncate px-4 py-2.5 sm:table-cell">{r.course}</td>
                          <td className="px-4 py-2.5">
                            <StatusChip tone={CHIP[r.bucket].tone} className="whitespace-nowrap">{CHIP[r.bucket].label}</StatusChip>
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {dueLabel(r.dueDate, now, dateCtx)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          <aside className="space-y-8">
            <section aria-labelledby="week-heading" className="space-y-2">
              <h2 id="week-heading" className="text-foreground text-base font-semibold">
                This week
              </h2>
              <dl className="divide-border divide-y text-sm">
                {[
                  ["Courses", data.stats.courses],
                  ["Students", data.stats.students],
                  ["To mark", data.stats.toMark],
                  ["Due in 7 days", data.stats.dueThisWeek],
                ].map(([label, value]) => (
                  <div key={label} className="flex h-9 items-center justify-between">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-foreground font-mono tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="next-heading" className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 id="next-heading" className="text-foreground text-base font-semibold">
                  Coming up
                </h2>
                <Link href="/dashboard/calendar" className="text-muted-foreground hover:text-foreground text-xs hover:underline">
                  Calendar
                </Link>
              </div>
              {data.upcoming.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sessions in the next 7 days.</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {data.upcoming.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground truncate">{e.title}</p>
                        <p className="text-muted-foreground truncate text-xs">{e.course}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {dueLabel(e.date, now, dateCtx)},{" "}
                        {formatDate(e.date, dateCtx, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
