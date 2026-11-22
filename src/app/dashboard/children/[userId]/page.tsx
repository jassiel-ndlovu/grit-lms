/**
 * /dashboard/children/[userId] — a parent's view of one linked child.
 *
 * Server Component. Only a guardian with an ACTIVE guardianship over this
 * child gets in (`viewer.children` plus `canIn(..., { childUserId })`);
 * anyone else gets a 404, so the page never confirms a child exists.
 *
 * Shows the child's courses per workspace with lesson progress, released
 * marks only, and tests and assignments due in the next two weeks.
 * Read-only: the rows don't link into the student pages, which act as the
 * signed-in student.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, CalendarDays, GraduationCap, Hourglass, Pencil, Receipt, Target, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { getChildOverview } from "@/features/activity/child-overview";
import { getAttendanceHistory } from "@/features/calendar/actions";
import { AttendanceHistory, type HistoryRow } from "@/features/events/components/attendance-history";
import { calendarRoutes } from "@/features/events/lib/calendar-ui";
import { childRoutes, UPCOMING_DAYS, upcomingStatusLabel, isHandedIn } from "@/features/activity/lib/child-overview";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";
import { canIn, getViewer } from "@/lib/viewer";

export const metadata = { title: "Your learner" };

export default async function ChildPage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { userId } = await params;
  const child = viewer.children.find((c) => c.userId === userId);
  if (!child || !(await canIn(viewer, "grades.view", { childUserId: userId }))) notFound();

  const prefs = await getUserPreferences(viewer.user.id);
  const dateCtx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const shortDate = (d: Date) => formatDate(d, dateCtx, { weekday: "short", month: "short", day: "numeric" });

  const [overview, attendance] = await Promise.all([getChildOverview(child, new Date()), getAttendanceHistory({ childUserId: userId })]);
  const courseCount = overview.workspaces.reduce((s, w) => s + w.courses.length, 0);
  const latest = overview.marks[0] ?? null;

  return (
    <PageFrame type="record" breadcrumb={[{ label: "Your learners", href: childRoutes.home }, { label: child.name }]}>
      <PageTitle
        eyebrow={child.workspaces.length ? child.workspaces.map((w) => w.name).join(" · ") : "Not learning anywhere yet"}
        title={child.name}
        description={
          courseCount === 0
            ? "No courses yet."
            : `${courseCount} ${courseCount === 1 ? "course" : "courses"}. ${overview.progress.done} of ${overview.progress.total} lessons completed.`
        }
        properties={
          <StatTiles>
            <StatTile icon={<TrendingUp />} label="Progress" value={`${overview.progress.percent}%`} />
            <StatTile icon={<Target />} label="Due soon" value={String(overview.upcoming.length)} />
            <StatTile icon={<GraduationCap />} label="Latest mark" value={latest ? `${latest.percent}%` : "-"} />
          </StatTiles>
        }
      />

      <section className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">Courses</h2>
        {courseCount === 0 ? (
          <Card className="p-0">
            <EmptyState
              compact
              illustration={<Scene name="empty-courses" />}
              title="No courses yet"
              description={`Courses ${child.name.split(" ")[0]} is enrolled in show here.`}
            />
          </Card>
        ) : (
          overview.workspaces
            .filter((w) => w.courses.length > 0)
            .map((w) => (
              <div key={w.id ?? "other"} className="space-y-3">
                <h3 className="text-muted-foreground text-sm font-medium">{w.name}</h3>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {w.courses.map((c) => (
                    <li key={c.id}>
                      <Card className="flex h-full flex-col gap-3 p-5">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs">{c.tutorName ?? "Course"}</p>
                          <p className="font-display line-clamp-2 text-lg leading-tight tracking-tight text-foreground">{c.name}</p>
                        </div>
                        <div className="mt-auto space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <BookOpen className="size-3" />
                              Lessons
                            </span>
                            <span className="font-medium tabular-nums">
                              {c.progress.done}/{c.progress.total}
                            </span>
                          </div>
                          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                            <div className="bg-brand-terracotta h-full" style={{ width: `${c.progress.percent}%` }} />
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-foreground text-base font-semibold">
            Due in the next {UPCOMING_DAYS / 7} weeks
          </h2>
          <Card className="overflow-hidden p-0">
            {overview.upcoming.length === 0 ? (
              <EmptyState
                compact
                illustration={<Scene name="calendar-empty" />}
                title="Nothing due soon"
                description="Tests and assignments due in the next two weeks show up here."
              />
            ) : (
              <ul className="divide-border divide-y">
                {overview.upcoming.map((item) => {
                  const Icon = item.kind === "test" ? Pencil : Hourglass;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 shrink-0 items-center justify-center rounded-md">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.courseName} · {item.kind === "test" ? "Test" : "Assignment"} · {upcomingStatusLabel(item)}
                        </p>
                      </div>
                      <Badge variant={isHandedIn(item.status) ? "soft" : "secondary"} className="shrink-0 tabular-nums">
                        {shortDate(item.dueDate)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-base font-semibold">Recent marks</h2>
          <Card className="overflow-hidden p-0">
            {overview.marks.length === 0 ? (
              <EmptyState
                compact
                illustration={<Scene name="nothing-to-grade" />}
                title="No marks released yet"
                description="Marks show up here once the tutor releases them."
              />
            ) : (
              <ul className="divide-border divide-y">
                {overview.marks.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 shrink-0 items-center justify-center rounded-md">
                      <GraduationCap className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {m.courseName} · {shortDate(m.date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={m.percent >= 50 ? "soft" : "secondary"} className="hidden tabular-nums sm:inline-flex">
                        {m.percent}%
                      </Badge>
                      <span className="font-display tabular-nums text-foreground text-sm">
                        {m.score}
                        <span className="text-muted-foreground"> / {m.outOf}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">Attendance</h2>
          <Link href={calendarRoutes.view({ view: "agenda", child: userId })} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <CalendarDays className="size-3.5" />
            {child.name.split(" ")[0]}&apos;s calendar
          </Link>
        </div>
        <AttendanceHistory
          rows={(attendance?.data ?? []) as HistoryRow[]}
          timeZone={dateCtx.timeZone}
          locale={dateCtx.locale}
          empty={
            <EmptyState
              compact
              illustration={<Scene name="calendar-empty" />}
              title="No attendance yet"
              description="When a tutor marks a session, it shows here. You get an email if your child is marked absent."
            />
          }
        />
      </section>

      <Card className="divide-border divide-y p-0">
        <Link href="/dashboard/fees" className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 text-sm transition-colors">
          <Receipt className="text-brand-terracotta size-4" />
          Fees for {child.name.split(" ")[0]}
        </Link>
      </Card>
    </PageFrame>
  );
}
