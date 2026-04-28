/**
 * Notification server-only helpers.
 *
 * `emitNotification` is the single typed entry point feature actions use to
 * write notifications. Centralising it lets us:
 *   - validate every emit against the same Zod schema
 *   - apply consistent revalidation
 *   - swap the storage backend later (e.g. push to a queue) without
 *     touching every call site
 *
 * Public Server Actions live in `./actions.ts` and are tied to the
 * student. Notifications are written by other features (e.g. createLesson),
 * so we deliberately keep this helper outside the safe-action client tree.
 */

import "server-only";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

import {
  CreateNotificationInputSchema,
  type CreateNotificationInput,
} from "./schemas";

export interface EmitNotificationOptions {
  /**
   * Whether to revalidate the student-facing notification surfaces. Default
   * true. Pass `false` from inside a feature action that already triggers
   * revalidation for the same routes (avoid double work).
   */
  revalidate?: boolean;
}

/**
 * Validate and persist a notification. Throws if the input doesn't satisfy
 * the schema (in particular, if neither studentId nor courseId is set).
 */
export async function emitNotification(
  input: CreateNotificationInput,
  options: EmitNotificationOptions = {},
) {
  const parsed = CreateNotificationInputSchema.parse(input);

  const created = await prisma.notification.create({
    data: {
      title: parsed.title,
      message: parsed.message,
      link: parsed.link ?? null,
      type: parsed.type,
      priority: parsed.priority,
      studentId: parsed.studentId ?? null,
      courseId: parsed.courseId ?? null,
    },
    select: { id: true },
  });

  if (options.revalidate ?? true) {
    // The bell self-fetches on mount, but RSC pages that read the full
    // list / unread count need to re-render after a new emit.
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
  }

  return { id: created.id };
}
