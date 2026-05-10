/**
 * /dashboard/calendar - schedule with toggleable Calendar/List views.
 *
 * Server Component. Synthesizes a unified CalendarItem feed from:
 *   - CourseEvent rows (lectures, exams, reminders, etc.)
 *   - Tests due (active tests scoped to the user)
 *   - Submissions due (active assignments scoped to the user)
 *
 * The view toggle is URL-driven (`?view=grid|list`) so refreshes preserve
 * the choice. Tutors get a "New event" button in the page header.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Megaphone,
  Pencil,
  Presentation,
  Timer,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  listUpcomingEventsForStudent,
  listUpcomingEventsForTutor,
} from "@/features/events/queries";
import { listActiveTestsByCourseId, listActiveTestsForStudent } from "@/features/assessments/queries";
import {
  listActiveSubmissionsByCourseId,
  listActiveSubmissionsForStudent,
} from "@/features/submissions/queries";
import { listCoursesByTutorId } from "@/features/courses/queries";
import {
  CalendarView,
  type CalendarItem,
} from "@/features/events/components/calendar-view";
import { CreateEventButton } from "@/features/events/components/create-event-button";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export const metadata = { title: "Schedule" };

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  LECTURE: { label: "Lecture", icon: Presentation },
  TEST: { label: "Test", icon: Pencil },
  EXAM: { label: "Exam", icon: GraduationCap },
  REMINDER: { label: "Reminder", icon: Megaphone },
  SUBMISSION: { label: "Assignment", icon: Pencil },
  LIVE: { label: "Live session", icon: Timer },
  MEETING: { label: "Meeting", icon: CalendarDays },
  HOLIDAY: { label: "Holiday", icon: CalendarDays },
};

function dayKey(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { view } = await searchParams;
  const isGrid = view !== "list"; // default to grid; ?view=list flips to list

  const session = await auth();
  if (!session?.user) redirect("/");

  // ───── Build the feed (role-branched) ─────
  let items: CalendarItem[] = [];
  let tutorCourses: { id: string; name: string }[] = [];

  if (session.user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!student) {
      return (
        <div className="text-muted-foreground p-8 text-sm">
          No student profile found for this account.
        </div>
      );
    }

    const [events, tests, assignments] = await Promise.all([
      listUpcomingEventsForStudent(student.id),
      listActiveTestsForStudent(student.id),
      listActiveSubmissionsForStudent(student.id),
    ]);

    items = [
      ...events.map((e) => ({
        id: e.id,
        kind: "event" as const,
        type: e.type,
        title: e.title,
        date: e.date,
        course: { id: e.course.id, name: e.course.name },
        description: e.description,
        location: e.location,
        duration: e.duration,
        link: e.link,
        href: null,
      })),
      ...tests.map((t) => ({
        id: t.id,
        kind: "test" as const,
        title: t.title,
        date: t.dueDate,
        course: { id: t.course.id, name: t.course.name },
        description: null,
        location: null,
        duration: t.timeLimit,
        link: null,
        href: `/dashboard/tests/pre-test/${t.id}`,
      })),
      ...assignments.map((a) => ({
        id: a.id,
        kind: "assignment" as const,
        title: a.title,
        date: a.dueDate,
        course: { id: a.course.id, name: a.course.name },
        description: a.description,
        location: null,
        duration: null,
        link: null,
        href: `/dashboard/submissions/${a.id}`,
      })),
    ];
  } else if (session.user.role === "TUTOR") {
    const tutor = await prisma.tutor.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!tutor) {
      return (
        <div className="text-muted-foreground p-8 text-sm">
          No tutor profile found for this account.
        </div>
      );
    }

    const courses = await listCoursesByTutorId(tutor.id);
    tutorCourses = courses.map((c) => ({ id: c.id, name: c.name }));

    const events = await listUpcomingEventsForTutor(tutor.id);

    // For tutors, also surface tests + assignments they own. Fan out per
    // course so we reuse the existing per-course queries.
    const perCourse = await Promise.all(
      courses.map(async (c) => {
        const [tests, subs] = await Promise.all([
          listActiveTestsByCourseId(c.id),
          listActiveSubmissionsByCourseId(c.id),
        ]);
        return { course: c, tests, subs };
      }),
    );

    items = [
      ...events.map((e) => ({
        id: e.id,
        kind: "event" as const,
        type: e.type,
        title: e.title,
        date: e.date,
        course: { id: e.course.id, name: e.course.name },
        description: e.description,
        location: e.location,
        duration: e.duration,
        link: e.link,
        href: null,
      })),
      ...perCourse.flatMap(({ course, tests, subs }) => [
        ...tests.map((t) => ({
          id: t.id,
          kind: "test" as const,
          title: t.title,
          date: t.dueDate,
          course: { id: course.id, name: course.name },
          description: null,
          location: null,
          duration: t.timeLimit,
          link: null,
          href: `/dashboard/tutor-tests`,
        })),
        ...subs.map((s) => ({
          id: s.id,
          kind: "assignment" as const,
          title: s.title,
          date: s.dueDate,
          course: { id: course.id, name: course.name },
          description: s.description,
          location: null,
          duration: null,
          link: null,
          href: `/dashboard/submissions/${s.id}`,
        })),
      ]),
    ];
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            Schedule
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Lectures, tests, and reminders across your courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle (URL-driven, RSC-friendly) */}
          <div className="flex rounded-md border border-border bg-card p-0.5">
            <Button
              asChild
              variant={isGrid ? "default" : "ghost"}
              size="sm"
              className="h-8"
            >
              <Link href="/dashboard/calendar">Calendar</Link>
            </Button>
            <Button
              asChild
              variant={!isGrid ? "default" : "ghost"}
              size="sm"
              className="h-8"
            >
              <Link href="/dashboard/calendar?view=list">List</Link>
            </Button>
          </div>
          {session.user.role === "TUTOR" && tutorCourses.length > 0 && (
            <CreateEventButton courses={tutorCourses} />
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <Card className="flex min-h-70 flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              Nothing on the schedule
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              {session.user.role === "TUTOR"
                ? "Click \"New event\" to add the first item."
                : "Upcoming sessions added by your tutors will appear here."}
            </p>
          </div>
        </Card>
      ) : isGrid ? (
        <CalendarView items={items} />
      ) : (
        <ListView items={items} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* List view (the legacy schedule layout, kept as a toggle option)            */
/* ──────────────────────────────────────────────────────────────────────── */

function ListView({ items }: { items: CalendarItem[] }) {
  // Group by day for a chronological agenda layout.
  const byDay = new Map<string, { date: Date; rows: CalendarItem[] }>();
  for (const e of items) {
    const key = dayKey(e.date);
    if (!byDay.has(key)) byDay.set(key, { date: e.date, rows: [] });
    byDay.get(key)!.rows.push(e);
  }

  return (
    <div className="space-y-5">
      {Array.from(byDay.values()).map((day) => (
        <Card key={dayKey(day.date)} className="overflow-hidden p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 py-3">
            <h2 className="font-display text-base leading-tight tracking-tight text-foreground">
              {dayFmt.format(day.date)}
            </h2>
            <span className="text-muted-foreground text-xs">
              {day.rows.length} {day.rows.length === 1 ? "event" : "events"}
            </span>
          </div>
          <Separator />
          <ul className="divide-border divide-y">
            {day.rows.map((event) => {
              const meta =
                event.kind === "test"
                  ? { label: "Test due", icon: Pencil }
                  : event.kind === "assignment"
                    ? { label: "Assignment due", icon: Pencil }
                    : (TYPE_META[event.type ?? ""] ?? {
                        label: "Event",
                        icon: CalendarDays,
                      });
              const Icon = meta.icon;
              return (
                <li
                  key={`${event.kind}-${event.id}`}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex gap-3">
                    <div className="bg-brand-terracotta/12 text-brand-terracotta mt-0.5 flex size-9 items-center justify-center rounded-md shrink-0">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">
                          {event.title}
                        </h3>
                        <Badge variant="secondary">{meta.label}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {event.course.name}
                      </p>
                      {event.description && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">
                          {event.description}
                        </p>
                      )}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Timer className="size-3" />
                          {timeFmt.format(event.date)}
                          {event.duration ? ` · ${event.duration} min` : ""}
                        </span>
                        {event.link && (
                          <Link
                            href={event.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-terracotta hover:underline inline-flex items-center gap-1"
                          >
                            Open link
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                        {event.href && (
                          <Link
                            href={event.href}
                            className="text-brand-terracotta hover:underline"
                          >
                            Open details
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
