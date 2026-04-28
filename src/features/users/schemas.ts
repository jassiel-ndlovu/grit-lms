/**
 * User & preferences schemas. The application-facing student/tutor identities
 * live under features/students and features/tutors respectively.
 */

import { z } from "zod";

import { CuidSchema, EmailSchema, NonEmptyString } from "../shared/primitives";
import {
  DashboardTabSchema,
  NotificationFrequencySchema,
  PreferredViewSchema,
  RoleSchema,
} from "../shared/enums";

export const UserSchema = z.object({
  id: CuidSchema,
  name: NonEmptyString.max(120),
  email: EmailSchema,
  role: RoleSchema,
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const UserPreferencesSchema = z.object({
  id: CuidSchema,
  userId: CuidSchema,
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  notificationFrequency: NotificationFrequencySchema.default("IMMEDIATE"),
  notifyOnCourseUpdate: z.boolean().default(true),
  notifyOnNewLesson: z.boolean().default(true),
  notifyOnNewTest: z.boolean().default(true),
  notifyOnDueDateReminder: z.boolean().default(true),
  notifyOnGrades: z.boolean().default(true),
  notifyOnMessages: z.boolean().default(true),
  darkMode: z.boolean().default(false),
  preferredLanguage: z.string().default("EN"),
  timeZone: z.string().nullable(),
  preferredView: PreferredViewSchema.default("LIST"),
  studyReminders: z.boolean().default(false),
  defaultDashboardTab: DashboardTabSchema.default("COURSES"),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UpdateUserPreferencesSchema = UserPreferencesSchema.partial()
  .omit({ id: true, userId: true });
export type UpdateUserPreferencesInput = z.infer<
  typeof UpdateUserPreferencesSchema
>;
