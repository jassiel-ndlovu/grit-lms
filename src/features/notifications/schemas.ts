/**
 * Notification schemas.
 *
 * Pattern (mirrors features/courses and features/lessons):
 *   - NotificationSchema             full row shape (matches Prisma model)
 *   - CreateNotificationInputSchema  input for the internal `emitNotification`
 *                                    helper. Not exposed as a public Server
 *                                    Action — the public surface is
 *                                    feature-side (createLesson, etc.)
 *                                    which calls into the helper.
 *   - MarkReadSchema / MarkUnreadSchema
 *                                    inputs for student-facing actions.
 *   - MarkAllReadSchema             zero-input action; an empty object is
 *                                    required so next-safe-action's
 *                                    `schema()` has something to validate.
 *
 * Notifications fan out via an OR of `studentId` (direct recipient) or
 * `courseId` (broadcast to enrolled students). Read state lives on the
 * notification row itself, so a course-wide notification flips read for
 * everyone the moment the first student dismisses it. We're keeping that
 * legacy semantic for v2 — per-student read state would require a join
 * table and a migration.
 *
 * Note: `link` is intentionally a plain nullable string (not a URL) because
 * the legacy data stores app-relative paths like
 * `/dashboard/courses/lessons/<id>`, which would fail `.url()` validation.
 */

import { z } from "zod";

import { CuidSchema, DateSchema, NonEmptyString } from "../shared/primitives";
import {
  NotificationPrioritySchema,
  NotificationTypeSchema,
} from "../shared/enums";

/* ------------------------------------------------------------------------- */
/* Row shape                                                                 */
/* ------------------------------------------------------------------------- */

export const NotificationSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  message: NonEmptyString,
  link: z.string().nullable(),
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema.default("NORMAL"),
  isRead: z.boolean().default(false),
  createdAt: DateSchema,
  readAt: DateSchema.nullable(),
  studentId: CuidSchema.nullable(),
  courseId: CuidSchema.nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

/* ------------------------------------------------------------------------- */
/* Internal create input — used by emitNotification()                        */
/* ------------------------------------------------------------------------- */

/**
 * At least one recipient anchor is required: either a direct student or a
 * course id (which fans out to enrolled students at read time). The Zod
 * refinement enforces it so calling code can't accidentally write a row
 * that nobody can read.
 */
export const CreateNotificationInputSchema = z
  .object({
    title: NonEmptyString.max(200),
    message: NonEmptyString,
    link: z.string().min(1).nullable().optional(),
    type: NotificationTypeSchema,
    priority: NotificationPrioritySchema.default("NORMAL"),
    studentId: CuidSchema.nullable().optional(),
    courseId: CuidSchema.nullable().optional(),
  })
  .refine((v) => Boolean(v.studentId) || Boolean(v.courseId), {
    message: "A notification must target a student, a course, or both.",
    path: ["studentId"],
  });
export type CreateNotificationInput = z.infer<
  typeof CreateNotificationInputSchema
>;

/* ------------------------------------------------------------------------- */
/* Action inputs                                                             */
/* ------------------------------------------------------------------------- */

export const MarkReadSchema = z.object({ id: CuidSchema });
export type MarkReadInput = z.infer<typeof MarkReadSchema>;

export const MarkUnreadSchema = z.object({ id: CuidSchema });
export type MarkUnreadInput = z.infer<typeof MarkUnreadSchema>;

/** Zero-input action; empty object is required by next-safe-action's schema. */
export const MarkAllReadSchema = z.object({});
export type MarkAllReadInput = z.infer<typeof MarkAllReadSchema>;
