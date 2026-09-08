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

/* ------------------------------------------------------------------------- */
/* User provisioning (tutor-only actions)                                    */
/* ------------------------------------------------------------------------- */

/**
 * Passwords are stored hashed. This is the raw plaintext accepted from the
 * form — validated once, hashed inside the action, then discarded.
 */
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long");

/**
 * Create a Student user in one submit. The action creates:
 *   1. a User row (role=STUDENT, hashed password)
 *   2. a Student row (linked by email; the app resolves the profile by
 *      matching Student.email to session.user.email)
 * Both rows use the same email so the mapping is stable.
 */
export const CreateStudentUserSchema = z.object({
  fullName: NonEmptyString.max(120, "Name too long"),
  email: EmailSchema,
  password: PasswordSchema,
  imageUrl: z
    .string()
    .url("Must be a valid URL")
    .nullable()
    .optional()
    .default(null),
});
export type CreateStudentUserInput = z.infer<typeof CreateStudentUserSchema>;

/**
 * Reset a user's password by user id. Only tutors can invoke it. The old
 * password is not required — tutors are trusted administrators.
 */
export const ResetUserPasswordSchema = z.object({
  userId: CuidSchema,
  newPassword: PasswordSchema,
});
export type ResetUserPasswordInput = z.infer<typeof ResetUserPasswordSchema>;

/**
 * Signed-in user updates their own name / bio / avatar. `bio` and
 * `imageUrl` are only meaningful for tutors and students respectively;
 * the server action applies whichever fields the role permits.
 */
export const UpdateOwnProfileSchema = z.object({
  fullName: NonEmptyString.max(120, "Name too long"),
  bio: z.string().max(2000, "Bio too long").nullable().optional(),
  imageUrl: z
    .string()
    .url("Must be a valid URL")
    .nullable()
    .optional(),
});
export type UpdateOwnProfileInput = z.infer<typeof UpdateOwnProfileSchema>;

/**
 * Signed-in user changes their own password. Requires the current
 * password so a compromised session can't rotate the credential.
 */
export const ChangeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PasswordSchema,
    confirmPassword: PasswordSchema,
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangeOwnPasswordInput = z.infer<typeof ChangeOwnPasswordSchema>;

/**
 * Settings page — the writable subset of UserPreferences. Every field is
 * optional; the server action patches only supplied fields.
 */
export const UpdateOwnPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  notificationFrequency: NotificationFrequencySchema.optional(),
  notifyOnCourseUpdate: z.boolean().optional(),
  notifyOnNewLesson: z.boolean().optional(),
  notifyOnNewTest: z.boolean().optional(),
  notifyOnDueDateReminder: z.boolean().optional(),
  notifyOnGrades: z.boolean().optional(),
  notifyOnMessages: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  preferredLanguage: z.string().max(10).optional(),
  timeZone: z.string().max(64).nullable().optional(),
  preferredView: PreferredViewSchema.optional(),
  studyReminders: z.boolean().optional(),
  defaultDashboardTab: DashboardTabSchema.optional(),
});
export type UpdateOwnPreferencesInput = z.infer<
  typeof UpdateOwnPreferencesSchema
>;
