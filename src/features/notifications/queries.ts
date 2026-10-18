/**
 * Notification queries — server-only data access for the notifications feature.
 *
 * These run inside React Server Components and Server Actions. Each
 * top-level export is wrapped in React's `cache()` so the same call is
 * deduplicated across a request.
 *
 * A notification "belongs" to a viewer if it's addressed to their user id,
 * or (legacy rows only) to their Student row or an enrolled course. See
 * `buildRecipientWhere`.
 *
 * Returns are kept lean — only the columns the bell + full page need.
 * No joins to Student/Course unless we actually render them.
 */

import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------------- */
/* Recipient resolution                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Who is reading. Every role has a userId; students also have a Student
 * row, which legacy (pre per-user) notifications are keyed by.
 */
export interface NotificationViewer {
  userId: string;
  studentId: string | null;
}

const resolveViewer = cache(
  async (id: string, email: string, role: string): Promise<NotificationViewer> => {
    if (role !== "STUDENT") return { userId: id, studentId: null };
    const student = await prisma.student.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return { userId: id, studentId: student?.id ?? null };
  },
);

export function getNotificationViewer(user: { id: string; email: string; role: string }) {
  return resolveViewer(user.id, user.email, user.role);
}

/**
 * Course ids the student is enrolled in, used to match legacy course-wide
 * broadcasts. Cached per-request.
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
 *
 *   - rows addressed to the viewer (userId) — everything emitted now
 *   - legacy rows (userId null) addressed to the student directly
 *   - legacy course broadcasts (no student) for an enrolled course
 *
 * Legacy rows that name a student AND a course are that student's receipt;
 * matching them by course too used to leak them to the whole class.
 */
export async function buildRecipientWhere(viewer: NotificationViewer) {
  const legacy: Prisma.NotificationWhereInput[] = [];
  if (viewer.studentId) {
    const courseIds = await getStudentEnrolledCourseIds(viewer.studentId);
    legacy.push({ userId: null, studentId: viewer.studentId });
    if (courseIds.length > 0) {
      legacy.push({ userId: null, studentId: null, courseId: { in: courseIds } });
    }
  }
  return { OR: [{ userId: viewer.userId }, ...legacy] } satisfies Prisma.NotificationWhereInput;
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
  ReturnType<typeof listNotifications>
>[number];

export interface ListNotificationsOptions {
  /** Cap result count — set on the bell to keep the dropdown small. */
  limit?: number;
  /** Restrict to unread rows. */
  unreadOnly?: boolean;
}

/**
 * All notifications visible to the viewer, newest first. Pass `{ limit }`
 * from the bell to keep payloads small.
 */
export const listNotifications = cache(
  async (viewer: NotificationViewer, options: ListNotificationsOptions = {}) => {
    const baseWhere = await buildRecipientWhere(viewer);
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
export const getUnreadCount = cache(async (viewer: NotificationViewer) => {
  const where = await buildRecipientWhere(viewer);
  return prisma.notification.count({
    where: { AND: [where, { isRead: false }] },
  });
});

/* ------------------------------------------------------------------------- */
/* Single-row lookup with ownership                                          */
/* ------------------------------------------------------------------------- */

/**
 * A single notification, only if it's visible to the viewer. Returns null
 * if either the row doesn't exist or the viewer shouldn't see it — Server
 * Actions use this to gate mark-read writes.
 */
export const getNotificationForViewer = cache(
  async (id: string, viewer: NotificationViewer) => {
    const where = await buildRecipientWhere(viewer);
    return prisma.notification.findFirst({
      where: { AND: [{ id }, where] },
      select: listSelect,
    });
  },
);
