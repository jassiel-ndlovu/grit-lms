/**
 * Notification Server Actions — typed mutations callable from the bell and
 * the full notifications page.
 *
 * These replace the legacy /api/notifications PUT (mark all) and
 * /api/notifications/[id] PUT (mark one) routes. All three actions:
 *   1. Run through studentActionClient (auth + role asserted in middleware).
 *   2. Validate input against a Zod schema.
 *   3. Verify ownership: a student can only flip notifications addressed
 *      to them directly OR to a course they're enrolled in. The check is
 *      shared with the read path via `getNotificationForStudent` /
 *      `buildRecipientWhere`, so visibility and write authorisation can
 *      never drift.
 *   4. Revalidate /dashboard (RSC bell data) and /dashboard/notifications
 *      (full page) so the next render picks up the new state.
 *
 * Notification creation lives in `./server.ts` (`emitNotification`) and is
 * called by other feature actions, not by clients.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { studentActionClient } from "@/lib/safe-action";

import {
  buildRecipientWhere,
  getNotificationForStudent,
  getUnreadCountForStudent,
  listNotificationsForStudent,
} from "./queries";
import {
  MarkAllReadSchema,
  MarkReadSchema,
  MarkUnreadSchema,
} from "./schemas";

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Resolve the calling user to a Student row. Both Server Actions need this
 * to scope ownership / recipient queries by studentId.
 */
async function requireStudentRecord(email: string) {
  const student = await prisma.student.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!student) {
    throw new Error("Student profile not found");
  }
  return student;
}

function revalidateNotificationSurfaces() {
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------------- */
/* markNotificationRead                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Flip a single notification to read. Verifies the row is visible to the
 * calling student before writing.
 */
export const markNotificationRead = studentActionClient
  .schema(MarkReadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await requireStudentRecord(ctx.session.user.email);

    const visible = await getNotificationForStudent(parsedInput.id, student.id);
    if (!visible) {
      throw new Error("Notification not found");
    }
    if (visible.isRead) {
      // Already read — no-op, return the existing id so the form succeeds.
      return { id: visible.id, alreadyRead: true };
    }

    await prisma.notification.update({
      where: { id: parsedInput.id },
      data: { isRead: true, readAt: new Date() },
    });

    revalidateNotificationSurfaces();

    return { id: parsedInput.id, alreadyRead: false };
  });

/* ------------------------------------------------------------------------- */
/* markNotificationUnread                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Flip a single notification back to unread (clears `readAt`). Useful from
 * the full page when a student wants to revisit an item later.
 */
export const markNotificationUnread = studentActionClient
  .schema(MarkUnreadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await requireStudentRecord(ctx.session.user.email);

    const visible = await getNotificationForStudent(parsedInput.id, student.id);
    if (!visible) {
      throw new Error("Notification not found");
    }
    if (!visible.isRead) {
      return { id: visible.id, alreadyUnread: true };
    }

    await prisma.notification.update({
      where: { id: parsedInput.id },
      data: { isRead: false, readAt: null },
    });

    revalidateNotificationSurfaces();

    return { id: parsedInput.id, alreadyUnread: false };
  });

/* ------------------------------------------------------------------------- */
/* markAllNotificationsRead                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Bulk-flip every notification the calling student can see to read. Reuses
 * the same recipient filter as `listNotificationsForStudent`, so the
 * visibility set used here is exactly what the bell + full page show.
 */
export const markAllNotificationsRead = studentActionClient
  .schema(MarkAllReadSchema)
  .action(async ({ ctx }) => {
    const student = await requireStudentRecord(ctx.session.user.email);

    const recipientWhere = await buildRecipientWhere(student.id);

    const result = await prisma.notification.updateMany({
      where: { AND: [recipientWhere, { isRead: false }] },
      data: { isRead: true, readAt: new Date() },
    });

    revalidateNotificationSurfaces();

    return { updated: result.count };
  });

/* ------------------------------------------------------------------------- */
/* getNotificationsForBell                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Read-only helper for the header bell. The bell is a Client component
 * mounted inside the dashboard's "use client" layout, so we can't pass
 * server-fetched props down to it; instead it calls this action on mount
 * (and after every mutation) to keep its dropdown fresh.
 *
 * Returns the unread count and the latest N rows in one round trip.
 */
const BellInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(8),
});

export const getNotificationsForBell = studentActionClient
  .schema(BellInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const student = await requireStudentRecord(ctx.session.user.email);

    const [unreadCount, items] = await Promise.all([
      getUnreadCountForStudent(student.id),
      listNotificationsForStudent(student.id, { limit: parsedInput.limit }),
    ]);

    return { unreadCount, items };
  });
