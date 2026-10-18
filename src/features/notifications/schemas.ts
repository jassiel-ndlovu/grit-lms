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
 * New notifications are written one row per recipient (`userId`), so read
 * state and preferences are per user. Legacy rows (userId null) are still
 * matched by `studentId` (direct) or `courseId` with no student (a course
 * broadcast whose read state is shared by the whole class).
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
 * Recipients are resolved from, in order of precedence:
 *   - `userIds`    explicit users (any role)
 *   - `studentId`  a single student (Student.id)
 *   - `courseId`   everyone in the course on the `audience` side: its
 *                  enrolled students (default) or its tutor
 * `courseId` is also stored on each row as context. The refinement makes
 * sure every emit has at least one way to find a recipient.
 */
export const NotificationAudienceSchema = z.enum(["students", "tutor"]);
export type NotificationAudience = z.infer<typeof NotificationAudienceSchema>;

export const CreateNotificationInputSchema = z
  .object({
    title: NonEmptyString.max(200),
    message: NonEmptyString,
    link: z.string().min(1).nullable().optional(),
    type: NotificationTypeSchema,
    priority: NotificationPrioritySchema.default("NORMAL"),
    studentId: CuidSchema.nullable().optional(),
    courseId: CuidSchema.nullable().optional(),
    userIds: z.array(CuidSchema).optional(),
    audience: NotificationAudienceSchema.default("students"),
  })
  .refine(
    (v) => Boolean(v.userIds?.length) || Boolean(v.studentId) || Boolean(v.courseId),
    {
      message: "A notification must target users, a student, or a course.",
      path: ["studentId"],
    },
  );
export type CreateNotificationInput = z.input<
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
