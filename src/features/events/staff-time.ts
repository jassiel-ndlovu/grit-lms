/**
 * Timesheets and cover for B's pages, over A's features/staff (viewer.md
 * Draft 1.24). Every list here only narrows what to show; A's functions and
 * actions check again. Server only.
 */

import "server-only";

import { notFound } from "next/navigation";

import { listCover } from "@/features/staff/cover";
import { managedMemberships } from "@/features/staff/scope";
import { getTimesheet, type TimesheetView } from "@/features/staff/timesheets";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { can, ViewerError, type Viewer } from "@/lib/viewer";

import { coverable, coverEntryId, type CoverInfo, type CoverView } from "./lib/staff-time-ui";
import type { CalendarEntry } from "./lib/calendar-ui";

const DAY = 86_400_000;
/** The longest span A's `listCover` takes. */
const COVER_DAYS = 93;

/** Timesheets and cover are for an organisation's staff. */
export function hasStaffTime(viewer: Viewer): boolean {
  return viewer.persona === "staff" && viewer.workspace?.kind === "ORGANISATION";
}

/** Tests a page's access: a timesheet that isn't theirs to see is a 404. */
export async function timesheetOr404(viewer: Viewer, input: { month: string; membershipId?: string }): Promise<TimesheetView> {
  try {
    return await getTimesheet(viewer, input);
  } catch (e) {
    if (e instanceof ViewerError || e instanceof UserError) notFound();
    throw e;
  }
}

/** The courses a member teaches, for "Other work". */
export async function coursesTaughtBy(membershipId: string): Promise<Array<{ id: string; name: string }>> {
  return prisma.course.findMany({ where: { staff: { some: { membershipId } } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** `manageable`: the viewer may arrange it or call it off. */
export type CoverRow = Awaited<ReturnType<typeof listCover>>[number] & { manageable: boolean };

async function listed(viewer: Viewer, from: Date, to: Date): Promise<CoverRow[]> {
  const scope = can(viewer, "cover.manage") ? await managedMemberships(viewer, "cover.manage") : [];
  const rows = await listCover(viewer, { from, to });
  return rows.map((r) => ({ ...r, manageable: scope === "ALL" || scope.includes(r.absent.membershipId) }));
}

/** The cover page's rows: what's coming up, or the past and cancelled. */
export async function coverRows(viewer: Viewer, view: CoverView, now: Date): Promise<CoverRow[]> {
  const from = (days: number) => new Date(now.getTime() + days * DAY);
  // A class that started in the last day may still be on.
  const ahead = await listed(viewer, from(-1), from(COVER_DAYS - 1));
  const live = (r: CoverRow) => r.status !== "CANCELLED" && r.endsAt > now;
  if (view === "upcoming") return ahead.filter(live);
  const before = await listed(viewer, from(-COVER_DAYS), from(-1));
  return [...before, ...ahead.filter((r) => !live(r))];
}

/** What the calendar shows and offers about cover. */
export interface CalendarCover {
  /** The viewer's membership, or null when they only manage. */
  me: string | null;
  /** May ask for cover for someone else, and pick who covers. */
  manages: boolean;
  /** Live requests by calendar entry id. */
  byEntry: Record<string, CoverInfo & { manageable: boolean }>;
  /** Courses whose classes the viewer may ask cover for. */
  myCourseIds: string[];
  /** Managers: who teaches each course on screen, of the staff they manage. */
  staffByCourse: Record<string, Array<{ membershipId: string; name: string }>>;
}

/** Null for anyone who has no use for cover. */
export async function calendarCover(
  viewer: Viewer,
  entries: readonly CalendarEntry[],
  range: { from: string; to: string },
  now: Date,
): Promise<CalendarCover | null> {
  if (!hasStaffTime(viewer)) return null;
  const me = viewer.membership?.id ?? null;
  const manages = can(viewer, "cover.manage");
  const open = entries.filter((e) => coverable(e, now));
  const courseIds = [...new Set(open.map((e) => e.courseId))];
  const [rows, mine, covering, scope] = await Promise.all([
    listed(viewer, new Date(range.from), new Date(range.to)),
    me ? prisma.courseStaff.findMany({ where: { membershipId: me, courseId: { in: courseIds } }, select: { courseId: true } }) : [],
    // On these courses only to cover a class: the other classes aren't theirs.
    me
      ? prisma.coverRequest.findMany({
          where: { coverMembershipId: me, addedCourseStaff: true, accessEndedAt: null, status: "ASSIGNED" },
          select: { courseId: true },
        })
      : [],
    manages ? managedMemberships(viewer, "cover.manage") : null,
  ]);
  const onlyCovering = new Set(covering.map((c) => c.courseId));
  const staff = scope
    ? await prisma.courseStaff.findMany({
        where: {
          courseId: { in: courseIds },
          membership: { status: "ACTIVE", workspaceId: viewer.workspace?.id ?? "-" },
          ...(scope === "ALL" ? {} : { membershipId: { in: scope } }),
        },
        orderBy: { membership: { user: { name: "asc" } } },
        select: { courseId: true, membershipId: true, membership: { select: { user: { select: { name: true } } } } },
      })
    : [];
  const staffByCourse: CalendarCover["staffByCourse"] = {};
  for (const s of staff) (staffByCourse[s.courseId] ??= []).push({ membershipId: s.membershipId, name: s.membership.user.name });
  const byEntry: CalendarCover["byEntry"] = {};
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    byEntry[coverEntryId(r.eventId, r.occurrenceStart)] = { id: r.id, status: r.status, absent: r.absent, cover: r.cover, manageable: r.manageable };
  }
  return { me, manages, byEntry, myCourseIds: mine.map((m) => m.courseId).filter((c) => !onlyCovering.has(c)), staffByCourse };
}
