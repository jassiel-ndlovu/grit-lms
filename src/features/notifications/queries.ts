/**
 * Notification queries — server-only data access for the notifications feature.
 *
 * These run inside React Server Components and Server Actions. Each
 * top-level export is wrapped in React's `cache()` so the same call is
 * deduplicated across a request.
 *
 * The legacy filter shape is preserved: a notification "belongs" to a
 * student if it's targeted directly at them OR if it's targeted at a
 * course they're enrolled in. We materialise the list of enrolled course
 * ids once per request and reuse it across the queries below.
 *
 * Returns are kept lean — only the columns the bell + full page need.
 * No joins to Student/Course unless we actually render them.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------------- */
/* Recipient resolution                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Course ids the student is enrolled in, used to broaden the OR in every
 * notification fetch. Cached per-request so a page that calls
 * listNotifications + getUnreadCount only hits the join table once.
 */
export const getStudentEnrolledCourseIds = cache(async (studentId: string) => {
  const courses = await prisma.course.findMany({
    where: { students: { some: { id: studentId } } },
    select: { id: true },
  });
  return courses.map((c) => c.id);
});

/**
 * Build the prisma `where` clause used by every list/count query.
 * Exported so feature actions can share the same recipient filter.
 */
export async function buildRecipientWhere(studentId: string) {
  const courseIds = await getStudentEnrolledCourseIds(studentId);
  return {
    OR: [
      { studentId },
      ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
    ],
  };
}

/* ------------------------------------------------------------------------- */
/* List queries                                                              */
/* ------------------------------------------------------------------------- */

const listSelect = {
  id: true,
  title: true,
  message: true,
  link: true,
  type: true,
  priority: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  studentId: true,
  courseId: true,
} as const;

export type NotificationListItem = Awaited<
  ReturnType<typeof listNotificationsForStudent>
>[number];

export interface ListNotificationsOptions {
  /** Cap result count — set on the bell to keep the dropdown small. */
  limit?: number;
  /** Restrict to unread rows. */
  unreadOnly?: boolean;
}

/**
 * All notifications visible to a student (direct + via enrolled courses),
 * newest first. Pass `{ limit }` from the bell to keep payloads small.
 */
export const listNotificationsForStudent = cache(
  async (studentId: string, options: ListNotificationsOptions = {}) => {
    const baseWhere = await buildRecipientWhere(studentId);
    const where = options.unreadOnly
      ? { AND: [baseWhere, { isRead: false }] }
      : baseWhere;

    return prisma.notification.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
      ...(options.limit ? { take: options.limit } : {}),
    });
  },
);

/* ------------------------------------------------------------------------- */
/* Counts                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Unread badge count. Cheap aggregate — no row data is sent across the
 * wire. Used by the bell and (optionally) the full page header.
 */
export const getUnreadCountForStudent = cache(async (studentId: string) => {
  const where = await buildRecipientWhere(studentId);
  return prisma.notification.count({
    where: { AND: [where, { isRead: false }] },
  });
});

/* ------------------------------------------------------------------------- */
/* Single-row lookup with ownership                                          */
/* ------------------------------------------------------------------------- */

/**
 * A single notification, only if it's visible to the calling student
 * (direct studentId match or via an enrolled courseId). Returns null if
 * either the row doesn't exist or the student shouldn't see it — Server
 * Actions use this to gate mark-read writes.
 */
export const getNotificationForStudent = cache(
  async (id: string, studentId: string) => {
    const courseIds = await getStudentEnrolledCourseIds(studentId);
    return prisma.notification.findFirst({
      where: {
        id,
        OR: [
          { studentId },
          ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
        ],
      },
      select: listSelect,
    });
  },
);
