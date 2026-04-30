/**
 * Lesson schemas.
 *
 * Pattern (mirrors features/courses):
 *   - <Entity>Schema             full row shape (matches Prisma model + relations)
 *   - Create<Entity>Schema       input for create mutations (omits id, createdAt)
 *   - Update<Entity>Schema       input for update mutations (id required, others optional)
 *   - Delete<Entity>Schema       input for delete mutations (id only)
 *   - Type aliases via z.infer (no hand-written parallel types)
 *
 * Lessons own their attachments. Attachments are modelled as a nested array
 * on create/update so the form can submit lesson + files atomically. On
 * update the array fully replaces the existing set (deleteMany + create).
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  UrlSchema,
} from "../shared/primitives";

/* ------------------------------------------------------------------------- */
/* Attachment                                                                */
/* ------------------------------------------------------------------------- */

export const AttachmentSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(120, "Title too long"),
  url: UrlSchema,
  lessonId: CuidSchema,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * Create input for an attachment. Used as a nested element on lesson
 * create/update — the lessonId is supplied implicitly by the Prisma
 * `connect`/`create` relation.
 */
export const CreateAttachmentSchema = AttachmentSchema.omit({
  id: true,
  lessonId: true,
});
export type CreateAttachmentInput = z.infer<typeof CreateAttachmentSchema>;

/* ------------------------------------------------------------------------- */
/* Lesson                                                                    */
/* ------------------------------------------------------------------------- */

export const LessonSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(120, "Title too long"),
  description: z.string().max(20000, "Description too long").nullable(),
  order: z.number().int().nonnegative(),
  courseId: CuidSchema,
  duration: z.number().int().positive().nullable(),
  videoUrl: z.array(UrlSchema).default([]),
  createdAt: DateSchema,
});
export type Lesson = z.infer<typeof LessonSchema>;

/**
 * Create input. Course is required, attachments + videos default to [].
 * `order` defaults to 0 (legacy behavior — the manage-lessons UI re-orders
 * after creation if needed). Duration is the only nullable input — the rest
 * use `.default()` so callers can omit them entirely.
 */
export const CreateLessonSchema = z.object({
  title: NonEmptyString.max(120, "Title too long"),
  description: z.string().max(20000, "Description too long").nullable(),
  courseId: CuidSchema,
  order: z.number().int().nonnegative().default(0),
  duration: z.number().int().positive().nullable().default(null),
  videoUrl: z.array(UrlSchema).default([]),
  attachments: z.array(CreateAttachmentSchema).default([]),
});
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

/**
 * Update input — `id` is required, every other field optional.
 * `attachments`, when supplied, REPLACES the attachment set (deleteMany + create).
 * Pass an empty array to clear all attachments; omit the field to keep them.
 */
export const UpdateLessonSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(120, "Title too long").optional(),
  description: z.string().max(20000, "Description too long").nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  duration: z.number().int().positive().nullable().optional(),
  videoUrl: z.array(UrlSchema).optional(),
  attachments: z.array(CreateAttachmentSchema).optional(),
});
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;

export const DeleteLessonSchema = z.object({
  id: CuidSchema,
});
export type DeleteLessonInput = z.infer<typeof DeleteLessonSchema>;

/**
 * Filter for listing lessons (e.g. by course). Limit/offset preserved for
 * future paginated views.
 */
export const LessonFilterSchema = z.object({
  courseId: CuidSchema.optional(),
  limit: z.number().int().positive().max(200).default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type LessonFilter = z.infer<typeof LessonFilterSchema>;

/* ------------------------------------------------------------------------- */
/* LessonCompletion                                                          */
/* ------------------------------------------------------------------------- */

export const LessonCompletionSchema = z.object({
  id: CuidSchema,
  studentId: CuidSchema,
  lessonId: CuidSchema,
  completedAt: DateSchema,
});
export type LessonCompletion = z.infer<typeof LessonCompletionSchema>;

/**
 * Mark-complete input. Only `lessonId` from the client — the studentId is
 * derived from the session inside the Server Action so a student can never
 * mark another student's lesson as complete.
 */
export const MarkLessonCompleteSchema = z.object({
  lessonId: CuidSchema,
});
export type MarkLessonCompleteInput = z.infer<typeof MarkLessonCompleteSchema>;

/**
 * Unmark-complete input. Mirrors mark — the action looks up the completion
 * by (studentId, lessonId) and deletes it if it exists.
 */
export const UnmarkLessonCompleteSchema = z.object({
  lessonId: CuidSchema,
});
export type UnmarkLessonCompleteInput = z.infer<
  typeof UnmarkLessonCompleteSchema
>;
