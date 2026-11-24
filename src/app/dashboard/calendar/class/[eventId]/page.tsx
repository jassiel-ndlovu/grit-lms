/**
 * /dashboard/calendar/class/[eventId]?at=<occurrenceStart> — class mode for
 * one session (owner, 24 Nov).
 *
 * Who may open it: whoever sees the session on their calendar. The session
 * comes from A's `listCalendarOccurrences`, which already narrows to the
 * viewer's courses; anything else is a 404, so the page never confirms an
 * event exists. The register and check-in code are there only when A's
 * `getAttendanceSheet` allows it (courses.edit on the course).
 */

import { notFound, redirect } from "next/navigation";
import { Presentation } from "lucide-react";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { listActiveTestsByCourseId } from "@/features/assessments/queries";
import { listActiveSubmissionsByCourseId } from "@/features/assignments/queries";
import { assignmentRoutes } from "@/features/assignments/routes";
import { hasService } from "@/features/billing/services";
import { getAttendanceSheet, listCalendarOccurrences } from "@/features/calendar/actions";
import { courseRoutes } from "@/features/courses/components/course-frame";
import { studentCourseRoutes } from "@/features/courses/lib/student-routes";
import { ClassMode, type ClassModeProps } from "@/features/events/components/class-mode";
import type { SheetLearner } from "@/features/events/components/attendance-sheet";
import { calendarRoutes, dayKeyOf, takesAttendance } from "@/features/events/lib/calendar-ui";
import { lessonsToShow } from "@/features/events/lib/class-mode";
import { buildLessonTree, flattenLessonTree } from "@/features/lessons/lib/lesson-tree";
import { listCompletionsForStudentInCourse, listLessonsByCourseId } from "@/features/lessons/queries";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Class" };

const DAY = 24 * 60 * 60 * 1000;
/** A moved session can sit this far from its original date (the calendar's own limit is 120 days). */
const LOOK_AROUND = 59 * DAY;
const DUE_AHEAD = 14 * DAY;

interface PageProps {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ at?: string }>;
}

export default async function ClassPage({ params, searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.persona !== "staff" && viewer.persona !== "learner") redirect(calendarRoutes.home);
  const [{ eventId }, { at }] = await Promise.all([params, searchParams]);
  const when = at ? Date.parse(at) : NaN;
  if (Number.isNaN(when)) notFound();

  const event = await prisma.courseEvent.findUnique({ where: { id: eventId }, select: { courseId: true } });
  if (!event) notFound();
  const { courseId } = event;

  const res = await listCalendarOccurrences({
    from: new Date(when - LOOK_AROUND).toISOString(),
    to: new Date(when + LOOK_AROUND).toISOString(),
    courseId,
  });
  if (!res?.data) {
    return (
      <PageMessage breadcrumb={[{ label: "Calendar", href: calendarRoutes.home }, { label: "Class" }]}>
        We couldn&apos;t load this session just now. Refresh to try again.
      </PageMessage>
    );
  }
  // The exact session, else the one nearest that time on the same day (a link made before it moved).
  const mine = res.data.filter((x) => x.eventId === eventId);
  const gap = (x: (typeof mine)[number]) => Math.abs(Date.parse(x.start) - when);
  const o =
    mine.find((x) => Date.parse(x.occurrenceStart) === when) ??
    mine.filter((x) => gap(x) < DAY / 2).sort((a, b) => gap(a) - gap(b))[0];
  if (!o) notFound();

  const prefs = await getUserPreferences(viewer.user.id);
  const timeZone = prefs.timeZone ?? DEFAULT_TIME_ZONE;
  const locale = resolveLocale(prefs.preferredLanguage);
  const now = new Date();
  const asLearner = viewer.persona === "learner";

  const student = asLearner ? await prisma.student.findUnique({ where: { userId: viewer.user.id }, select: { id: true } }) : null;
  const [live, sheet, lessonRows, completions, tests, assignments] = await Promise.all([
    hasService(viewer, courseId, "live-sessions"),
    asLearner || !takesAttendance({ kind: "event", type: o.type, cancelled: o.cancelled }) ? null : getAttendanceSheet({ eventId, occurrenceStart: o.occurrenceStart }),
    listLessonsByCourseId(courseId),
    student ? listCompletionsForStudentInCourse(student.id, courseId) : [],
    listActiveTestsByCourseId(courseId),
    listActiveSubmissionsByCourseId(courseId),
  ]);

  const done = new Set(completions.map((c) => c.lessonId));
  const readable = flattenLessonTree(buildLessonTree(lessonRows), [])
    .map((f) => f.lesson)
    .filter((l) => l.type !== "NONE");
  const shown = asLearner ? lessonsToShow(readable, done) : readable;
  const lessons: ClassModeProps["lessons"] = shown.map((l) => ({
    id: l.id,
    title: l.title,
    href: asLearner ? studentCourseRoutes.lessons(courseId, l.id) : courseRoutes.lessons(courseId, l.id),
    done: asLearner ? done.has(l.id) : null,
  }));

  const soon = (d: Date) => d.getTime() >= now.getTime() && d.getTime() <= now.getTime() + DUE_AHEAD;
  const due: ClassModeProps["due"] = [
    ...tests.filter((t) => soon(t.dueDate)).map((t) => ({
      id: t.id, kind: "Test" as const, title: t.title, at: t.dueDate.toISOString(),
      href: asLearner ? `/dashboard/tests/pre-test/${t.id}` : `/dashboard/tutor-tests/${t.id}/submissions`,
    })),
    ...assignments.filter((a) => soon(a.dueDate)).map((a) => ({
      id: a.id, kind: "Assignment" as const, title: a.title, at: a.dueDate.toISOString(), href: assignmentRoutes.detail(a.id),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const whenLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(o.start));

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Calendar", href: calendarRoutes.view({ view: "day", date: dayKeyOf(o.start, timeZone) }) }, { label: o.title }]}
    >
      <PageTitle icon={<Presentation />} eyebrow={o.courseName} title={o.title} description={whenLabel} />
      <ClassMode
        session={{
          eventId, occurrenceStart: o.occurrenceStart, start: o.start, end: o.end, cancelled: o.cancelled,
          link: o.link, location: o.location, description: o.description || null,
        }}
        now={now.getTime()}
        staff={sheet?.data ? { learners: sheet.data.learners as SheetLearner[], checkInOpenUntil: sheet.data.checkInOpenUntil, checkInCodes: live } : null}
        learner={asLearner ? { checkIn: live } : null}
        lessons={lessons}
        lessonsHref={asLearner ? studentCourseRoutes.lessons(courseId) : courseRoutes.lessons(courseId)}
        due={due}
      />
    </PageFrame>
  );
}
