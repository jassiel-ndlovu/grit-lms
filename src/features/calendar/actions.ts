"use server";

/**
 * Calendar and attendance actions for B's screens (#149). Staff need
 * `courses.edit` on the event's course (its tutor, or an owner or admin)
 * to edit a series, take attendance or open a check-in code. Learners
 * check in with a code and see their own history; guardians see their
 * children's.
 */

import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { viewerActionClient } from "@/lib/safe-action";
import { canIn, requireViewer, ViewerError, type Viewer } from "@/lib/viewer";

import {
  attendanceHistoryFor, attendanceSheetFor, checkInFor, editOccurrenceFor, markAttendanceFor, occurrencesFor, openCheckInFor, rotateFeedTokenFor,
} from "./calendar";
import { UserError } from "@/lib/user-error";

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Must be a date");

/** Courses whose events the viewer sees: taught or (owner/admin) the whole workspace; enrolled; children's. */
async function visibleCourseIds(viewer: Viewer): Promise<string[]> {
  const ids = new Set<string>();
  if (viewer.persona === "staff" && viewer.workspace) {
    const role = viewer.membership?.role;
    const where = (role === "OWNER" || role === "ADMIN") && viewer.mode !== "tutor"
      ? { workspaceId: viewer.workspace.id }
      : { workspaceId: viewer.workspace.id, staff: { some: { membershipId: viewer.membership?.id ?? "-" } } };
    for (const c of await prisma.course.findMany({ where, select: { id: true } })) ids.add(c.id);
  }
  const learnerOf = [viewer.user.id, ...viewer.children.map((c) => c.userId)];
  for (const e of await prisma.enrollment.findMany({ where: { endedAt: null, learner: { userId: { in: learnerOf } } }, select: { courseId: true } })) ids.add(e.courseId);
  return [...ids];
}

async function staffOfEvent(viewer: Viewer, eventId: string) {
  const e = await prisma.courseEvent.findUnique({ where: { id: eventId }, select: { courseId: true } });
  if (!e || !(await canIn(viewer, "courses.edit", { courseId: e.courseId }))) throw new ViewerError("FORBIDDEN");
}

/** Occurrences between two dates (at most 120 days), with "this one only" changes and cancellations applied. */
export const listCalendarOccurrences = viewerActionClient
  .schema(z.object({ from: iso, to: iso, courseId: z.string().optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const from = new Date(parsedInput.from);
    const to = new Date(parsedInput.to);
    if (!(to > from) || to.getTime() - from.getTime() > 120 * 24 * 60 * 60 * 1000) throw new UserError("Choose a range of up to 120 days");
    let courseIds = await visibleCourseIds(viewer);
    if (parsedInput.courseId) courseIds = courseIds.filter((c) => c === parsedInput.courseId);
    return occurrencesFor({ courseIds, from, to });
  });

const changes = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  start: iso.optional(),
  duration: z.number().int().min(5).max(24 * 60).optional(),
  location: z.string().max(300).nullable().optional(),
  link: z.string().url().max(500).nullable().optional(),
  cancelled: z.boolean().optional(),
});

/** Edit at one occurrence: THIS (this one only), FOLLOWING (this and following) or ALL. */
export const editCourseEventOccurrence = viewerActionClient
  .schema(z.object({ eventId: z.string().min(1), occurrenceStart: iso, scope: z.enum(["THIS", "FOLLOWING", "ALL"]), changes }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    await staffOfEvent(viewer, parsedInput.eventId);
    return editOccurrenceFor(viewer.user.id, parsedInput);
  });

export const getAttendanceSheet = viewerActionClient
  .schema(z.object({ eventId: z.string().min(1), occurrenceStart: iso }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    await staffOfEvent(viewer, parsedInput.eventId);
    return attendanceSheetFor(parsedInput.eventId, parsedInput.occurrenceStart);
  });

/** Marks Present / Late / Absent / Excused. A new Absent emails the learner's guardians once. */
export const markAttendance = viewerActionClient
  .schema(z.object({
    eventId: z.string().min(1),
    occurrenceStart: iso,
    marks: z.array(z.object({ learnerId: z.string().min(1), status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]), note: z.string().max(300).nullable().optional() })).min(1).max(300),
  }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    await staffOfEvent(viewer, parsedInput.eventId);
    return markAttendanceFor(viewer.user.id, parsedInput);
  });

/** Opens or rotates a check-in code (shown once) for 1 to 120 minutes, default 15. */
export const openCheckIn = viewerActionClient
  .schema(z.object({ eventId: z.string().min(1), occurrenceStart: iso, minutes: z.number().int().min(1).max(120).optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    await staffOfEvent(viewer, parsedInput.eventId);
    return openCheckInFor(viewer.user.id, parsedInput);
  });

/** A learner checks in. Returns { ok: false } for a wrong or expired code, or a class they aren't in. */
export const checkIn = viewerActionClient
  .schema(z.object({ code: z.string().trim().min(4).max(12) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    return checkInFor(viewer.user.id, parsedInput.code);
  });

/** The viewer's own attendance, or one of their children's (`childUserId`). */
export const getAttendanceHistory = viewerActionClient
  .schema(z.object({ childUserId: z.string().optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    let userId = viewer.user.id;
    if (parsedInput.childUserId) {
      if (!viewer.children.some((c) => c.userId === parsedInput.childUserId)) throw new ViewerError("FORBIDDEN");
      userId = parsedInput.childUserId;
    }
    const learners = await prisma.learner.findMany({ where: { userId }, select: { id: true } });
    return attendanceHistoryFor(learners.map((l) => l.id));
  });

/** A private calendar subscription URL for the viewer. Calling again replaces it (the old link stops working). */
export const getCalendarFeedUrl = viewerActionClient
  .schema(z.object({}))
  .action(async () => {
    const viewer = await requireViewer();
    const token = await rotateFeedTokenFor(viewer.user.id);
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.nexa-lms.co.za";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return { url: `${proto}://${host}/api/calendar/feed/${token}.ics`, webcal: `webcal://${host}/api/calendar/feed/${token}.ics` };
  });
