/**
 * Notification schemas.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  OptionalUrlSchema,
} from "../shared/primitives";
import {
  NotificationPrioritySchema,
  NotificationTypeSchema,
} from "../shared/enums";

export const NotificationSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  message: NonEmptyString,
  link: OptionalUrlSchema,
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema.default("NORMAL"),
  isRead: z.boolean().default(false),
  createdAt: DateSchema,
  readAt: DateSchema.nullable(),
  studentId: CuidSchema.nullable(),
  courseId: CuidSchema.nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationSchema = NotificationSchema.omit({
  id: true,
  createdAt: true,
  readAt: true,
  isRead: true,
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
