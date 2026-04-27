/**
 * Course schemas.
 *
 * Pattern (replicate this for every feature):
 *   - <Entity>Schema       full row shape (matches Prisma model + relations as needed)
 *   - Create<Entity>Schema input for create mutations (omit id, createdAt)
 *   - Update<Entity>Schema input for update mutations (partial Create + id)
 *   - <Entity>FilterSchema input for list/search queries
 *   - Type aliases via z.infer (no hand-written parallel types)
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  UrlSchema,
} from "../shared/primitives";

export const CourseSchema = z.object({
  id: CuidSchema,
  name: NonEmptyString.max(120, "Name too long"),
  description: z.string().max(2000, "Description too long").nullable(),
  imageUrl: UrlSchema,
  tutorId: CuidSchema,
  createdAt: DateSchema,
});
export type Course = z.infer<typeof CourseSchema>;

export const CreateCourseSchema = CourseSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

export const CourseFilterSchema = z.object({
  tutorId: CuidSchema.optional(),
  search: z.string().trim().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type CourseFilter = z.infer<typeof CourseFilterSchema>;
