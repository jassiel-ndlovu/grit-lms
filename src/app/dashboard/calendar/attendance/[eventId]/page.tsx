/**
 * /dashboard/calendar/attendance/[eventId]?at=<occurrenceStart> — the
 * attendance sheet for one session (#149).
 *
 * A's `getAttendanceSheet` checks `courses.edit` on the event's course and
 * that `at` is a real occurrence; anything else is a 404, so the page never
 * confirms an event exists. The register is Core; check-in codes and
 * absence emails need `live-sessions` (Plus). Framed as a record page: breadcrumb back to the
 * calendar on that day, then the sheet and the check-in code.
 */

import { notFound, redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { hasService } from "@/features/billing/services";
import { getAttendanceSheet } from "@/features/calendar/actions";
import { AttendanceSheet, CheckInPanel, type SheetLearner } from "@/features/events/components/attendance-sheet";
import { calendarRoutes, dayKeyOf } from "@/features/events/lib/calendar-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ at?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const [{ eventId }, { at }] = await Promise.all([params, searchParams]);
  if (!at || Number.isNaN(Date.parse(at))) notFound();

  const res = await getAttendanceSheet({ eventId, occurrenceStart: at });
  const sheet = res?.data;
  if (!sheet) notFound();

  const [prefs, event] = await Promise.all([
    getUserPreferences(viewer.user.id),
    prisma.courseEvent.findUnique({ where: { id: sheet.eventId }, select: { courseId: true } }),
  ]);
  const live = event != null && (await hasService(viewer, event.courseId, "live-sessions"));
  const timeZone = prefs.timeZone ?? DEFAULT_TIME_ZONE;
  const locale = resolveLocale(prefs.preferredLanguage);
  const when = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(sheet.occurrenceStart));
  const day = dayKeyOf(sheet.occurrenceStart, timeZone);

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Calendar", href: calendarRoutes.view({ view: "day", date: day }) }, { label: "Attendance" }]}
    >
      <PageTitle icon={<ClipboardCheck />} eyebrow="Attendance" title={sheet.title} description={when} />
      {live ? (
        <PageSection title="Check-in code" description="For a class that's on now.">
          <CheckInPanel eventId={sheet.eventId} occurrenceStart={sheet.occurrenceStart} openUntil={sheet.checkInOpenUntil} />
        </PageSection>
      ) : null}
      <PageSection
        title="Students"
        description={`P present, L late, A absent, E excused. Each mark saves straight away.${live ? " Parents get one email when their child is first marked absent." : ""}`}
      >
        <AttendanceSheet eventId={sheet.eventId} occurrenceStart={sheet.occurrenceStart} learners={sheet.learners as SheetLearner[]} />
      </PageSection>
      {live ? null : (
        <p className="text-muted-foreground text-sm">Check-in codes, and emails to parents about absences, come with the Plus plan.</p>
      )}
    </PageFrame>
  );
}
