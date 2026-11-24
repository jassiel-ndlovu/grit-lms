/**
 * /dashboard/calendar — month, week, day and agenda (#149).
 *
 * Server Component in the page frame (#205): the breadcrumb and "New
 * session" in the primary header, the view switch and date stepper in the
 * ribbon. URL state: `?view=month|week|day|agenda`, `?date=YYYY-MM-DD`
 * (the anchor; today when absent) and, for parents, `?child=<userId>`.
 *
 * Sessions come from A's `listCalendarOccurrences` for exactly the days on
 * screen (at most 42, under its 120-day limit), which already scopes them
 * by role: taught courses (owners and admins: the workspace), enrolled
 * courses, and children's courses. Booked lessons (bookings.ts) are added for
 * everyone, and tests and assignments due for students and tutors. Every time shows in the viewer's zone.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { listCalendarOccurrences } from "@/features/calendar/actions";
import { childRoutes } from "@/features/activity/lib/child-overview";
import { hasService } from "@/features/billing/services";
import { getCourseScope } from "@/features/courses/course-access";
import { listCoursesByTutorId } from "@/features/courses/queries";
import { bookingEntries } from "@/features/events/bookings";
import { childCourseIds, dueForCourses, dueForStudent } from "@/features/events/calendar-feed";
import { CalendarRibbon } from "@/features/events/components/calendar-ribbon";
import { CheckInButton, SubscribeButton } from "@/features/events/components/calendar-tools";
import { CalendarView } from "@/features/events/components/calendar-view";
import { CreateEventButton } from "@/features/events/components/create-event-button";
import { calendarRoutes, dayKeyOf, daysFor, parseDayKey, parseView, rangeFor, rangeLabel, type CalendarEntry } from "@/features/events/lib/calendar-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { auth } from "@/lib/auth";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendar" };

interface PageProps {
  searchParams: Promise<{ view?: string; date?: string; child?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const [viewer, session] = await Promise.all([getViewer(), auth()]);
  if (!viewer || !session?.user) redirect("/");
  const sp = await searchParams;

  const prefs = await getUserPreferences(viewer.user.id);
  const timeZone = prefs.timeZone ?? DEFAULT_TIME_ZONE;
  const locale = resolveLocale(prefs.preferredLanguage);
  const today = dayKeyOf(new Date(), timeZone);
  const view = parseView(sp.view);
  const anchor = parseDayKey(sp.date, today);
  const days = daysFor(view, anchor);
  const range = rangeFor(view, anchor, timeZone);

  // Parents see one child at a time.
  const guardian = viewer.persona === "guardian" && viewer.children.length > 0;
  const child = guardian ? (viewer.children.find((c) => c.userId === sp.child) ?? viewer.children[0]) : null;
  const tutor = session.user.role === "TUTOR";
  const learner = viewer.persona === "learner";

  const tutorCourses = tutor ? (await listCoursesByTutorId(await getCourseScope(session.user.id))).map((c) => ({ id: c.id, name: c.name })) : [];

  const [occ, due, onlyCourses, booked] = await Promise.all([
    listCalendarOccurrences({ from: range.from, to: range.to }),
    tutor ? dueForCourses(tutorCourses, range) : learner ? dueForStudent(session.user.email, range) : Promise.resolve([]),
    child ? childCourseIds(child.userId) : Promise.resolve(null),
    bookingEntries(viewer, range, child?.userId),
  ]);

  let entries: CalendarEntry[] = (occ?.data ?? []).map((o) => ({
    id: `${o.eventId}#${o.occurrenceStart}`, kind: "event" as const, eventId: o.eventId, occurrenceStart: o.occurrenceStart, start: o.start, end: o.end,
    title: o.title, description: o.description || null, type: o.type, location: o.location, link: o.link, cancelled: o.cancelled, changed: o.changed,
    recurring: o.recurring, courseId: o.courseId, courseName: o.courseName, href: null,
  }));
  if (onlyCourses) entries = entries.filter((e) => onlyCourses.has(e.courseId));
  entries = [...entries, ...booked, ...due];

  // Check-in codes come with live-sessions (Plus), course by course.
  const checkInCourseIds: string[] = [];
  if (learner) {
    const enrolled = await prisma.enrollment.findMany({
      where: { endedAt: null, learner: { userId: viewer.user.id } },
      select: { courseId: true },
      distinct: ["courseId"],
    });
    const on = await Promise.all(enrolled.map((e) => hasService(viewer, e.courseId, "live-sessions")));
    checkInCourseIds.push(...enrolled.filter((_, i) => on[i]).map((e) => e.courseId));
  }

  const label = rangeLabel(view, anchor, locale);
  const breadcrumb = child
    ? [{ label: child.name, href: childRoutes.child(child.userId) }, { label: "Calendar" }]
    : [{ label: "Calendar" }];

  return (
    <PageFrame
      type="list"
      breadcrumb={breadcrumb}
      actions={
        <>
          {checkInCourseIds.length > 0 && <CheckInButton size="sm" />}
          <SubscribeButton compact />
          {tutor && <CreateEventButton courses={tutorCourses} timeZone={prefs.timeZone ?? viewer.workspace?.timezone ?? DEFAULT_TIME_ZONE} initialDate={view === "day" ? anchor : undefined} />}
        </>
      }
      secondary={<CalendarRibbon view={view} anchor={anchor} today={today} child={child?.userId} label={label} />}
    >
      <PageTitle
        title={label}
        description={
          child
            ? `${child.name.split(" ")[0]}'s sessions, in ${timeZone.replace(/_/g, " ")} time.`
            : occ?.serverError
              ? "The calendar couldn't load. Refresh to try again."
              : tutor
                ? "Your sessions, and tests and assignments due on your courses."
                : "Your sessions, and tests and assignments due."
        }
        properties={
          guardian && viewer.children.length > 1 ? (
            <nav aria-label="Learner" className="flex flex-wrap gap-1.5">
              {viewer.children.map((c) => (
                <Link
                  key={c.userId}
                  href={calendarRoutes.view({ view, date: anchor === today ? null : anchor, child: c.userId })}
                  aria-current={c.userId === child?.userId ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    c.userId === child?.userId ? "border-foreground bg-foreground text-background" : "border-input hover:bg-accent",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      />
      <CalendarView
        view={view}
        days={days}
        anchor={anchor}
        today={today}
        entries={entries}
        child={child?.userId}
        ctx={{ timeZone, locale, editableCourseIds: tutorCourses.map((c) => c.id), checkInCourseIds, classMode: tutor || learner }}
        empty={
          <EmptyState
            compact
            illustration={<Scene name="calendar-empty" />}
            title={view === "day" ? "Nothing on this day" : "Nothing in the next 30 days"}
            description={tutor ? "Add a session with New session." : "Sessions your tutors add show up here."}
          />
        }
      />
    </PageFrame>
  );
}
