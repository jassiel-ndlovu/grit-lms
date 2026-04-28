/**
 * Prisma enums mirrored as Zod enums.
 *
 * Why duplicate? Prisma's generated TS enums work for typing, but they don't
 * give us runtime validation. Zod schemas across the codebase use these.
 *
 * Whenever you add or rename an enum in `prisma/schema.prisma`, mirror the
 * change here. A future improvement: codegen this from Prisma's DMMF.
 */

import { z } from "zod";

export const RoleSchema = z.enum(["STUDENT", "TUTOR", "ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const NotificationTypeSchema = z.enum([
  "COURSE_UPDATE",
  "LESSON_CREATED",
  "TEST_CREATED",
  "TEST_DELETED",
  "TEST_UPDATED",
  "QUIZ_CREATED",
  "SUBMISSION_CREATED",
  "SUBMISSION_DUE",
  "SUBMISSION_UPDATED",
  "SUBMISSION_DELETED",
  "SUBMISSION_GRADED",
  "TEST_DUE",
  "TEST_GRADED",
  "MESSAGE",
  "SYSTEM",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationPrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const ActivityTypeSchema = z.enum([
  "LESSON_COMPLETED",
  "TEST_COMPLETED",
  "ASSIGNMENT_SUBMITTED",
  "GRADE_RECEIVED",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "LOGIN",
  "LOGOUT",
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const QuestionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
  "FILE_UPLOAD",
  "MULTI_SELECT",
  "CODE",
  "MATCHING",
  "REORDER",
  "FILL_IN_THE_BLANK",
  "NUMERIC",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const SubmissionStatusSchema = z.enum([
  "SUBMITTED",
  "GRADED",
  "LATE",
  "IN_PROGRESS",
  "NOT_SUBMITTED",
  "NOT_STARTED",
]);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const EventTypeSchema = z.enum([
  "LECTURE",
  "TEST",
  "REMINDER",
  "SUBMISSION",
  "LIVE",
  "EXAM",
  "MEETING",
  "HOLIDAY",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const FileTypeSchema = z.enum(["PDF", "DOCX", "ZIP", "JPEG", "OTHER"]);
export type FileType = z.infer<typeof FileTypeSchema>;

export const NotificationFrequencySchema = z.enum([
  "IMMEDIATE",
  "DAILY",
  "WEEKLY",
  "NONE",
]);
export type NotificationFrequency = z.infer<typeof NotificationFrequencySchema>;

export const PreferredViewSchema = z.enum(["LIST", "GRID", "TIMELINE"]);
export type PreferredView = z.infer<typeof PreferredViewSchema>;

export const DashboardTabSchema = z.enum([
  "COURSES",
  "NOTIFICATIONS",
  "CALENDAR",
  "GRADES",
]);
export type DashboardTab = z.infer<typeof DashboardTabSchema>;
