/**
 * /dashboard/calendar — student schedule (and tutor schedule when role=TUTOR).
 *
 * Server Component. Pulls upcoming events for whichever role is calling and
 * groups by date. Replaces the legacy student-calendar / tutor-calendar
 * client pages — both contained the same data shape, just different fetch
 * sources, so we collapse to one RSC page that branches by role.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  MapPin,
  Megaphone,
  Pencil,
  Presentation,
  Timer,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  listUpcomingEventsForStudent,
  listUpcomingEventsForTutor,
} from "@/features/events/queries";

export const metadata = { title: "Schedule" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
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

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  let events:
    | Awaited<ReturnType<typeof listUpcomingEventsForStudent>>
    | Awaited<ReturnType<typeof listUpcomingEventsForTutor>> = [];

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
    events = await listUpcomingEventsForStudent(student.id);
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
    events = await listUpcomingEventsForTutor(tutor.id);
  }

  // Group by day for a chronological agenda layout.
  const byDay = new Map<string, { date: Date; rows: typeof events }>();
  for (const e of events) {
    const key = dayKey(e.date);
    if (!byDay.has(key)) byDay.set(key, { date: e.date, rows: [] });
    byDay.get(key)!.rows.push(e);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          Schedule
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Upcoming lectures, tests, and reminders across your courses.
        </p>
      </header>

      {events.length === 0 ? (
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              Nothing on the schedule
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Upcoming sessions added by your tutors will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {Array.from(byDay.values()).map((day) => (
            <Card key={dayKey(day.date)} className="overflow-hidden p-0">
              <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                <h2 className="font-display text-base leading-tight tracking-tight text-foreground">
                  {dateFmt.format(day.date)}
                </h2>
                <span className="text-muted-foreground text-xs">
                  {day.rows.length}{" "}
                  {day.rows.length === 1 ? "event" : "events"}
                </span>
              </div>
              <Separator />
              <ul className="divide-border divide-y">
                {day.rows.map((event) => {
                  const meta = TYPE_META[event.type] ?? {
                    label: event.type,
                    icon: CalendarDays,
                  };
                  const Icon = meta.icon;
                  return (
                    <li
                      key={event.id}
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
                            {event.course.name} · with {event.course.tutor.fullName}
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
                            {event.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" />
                                {event.location}
                              </span>
                            )}
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
      )}
    </div>
  );
}
