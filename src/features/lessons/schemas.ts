/**
 * Lesson schemas.
 *
 * Lessons own their attachments. We model attachments as a nested array on
 * create so the form can submit lesson + files atomically.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  UrlSchema,
} from "../shared/primitives";

export const AttachmentSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(120),
  url: UrlSchema,
  lessonId: CuidSchema,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const CreateAttachmentSchema = AttachmentSchema.omit({
  id: true,
  lessonId: true,
});
export type CreateAttachmentInput = z.infer<typeof CreateAttachmentSchema>;

export const LessonSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(120),
  description: z.string().max(2000).nullable(),
  order: z.number().int().nonnegative(),
  courseId: CuidSchema,
  duration: z.number().int().positive().nullable(),
  videoUrl: z.array(UrlSchema).default([]),
  createdAt: DateSchema,
});
export type Lesson = z.infer<typeof LessonSchema>;

export const CreateLessonSchema = LessonSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  attachments: z.array(CreateAttachmentSchema).default([]),
});
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

export const UpdateLessonSchema = CreateLessonSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;

export const LessonCompletionSchema = z.object({
  id: CuidSchema,
  studentId: CuidSchema,
  lessonId: CuidSchema,
  completedAt: DateSchema,
});
export type LessonCompletion = z.infer<typeof LessonCompletionSchema>;

export const CreateLessonCompletionSchema = LessonCompletionSchema.omit({
  id: true,
});
export type CreateLessonCompletionInput = z.infer<
  typeof CreateLessonCompletionSchema
>;
