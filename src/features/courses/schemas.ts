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
} from "../shared/primitives";
import { CourseCoverSchema } from "./lib/stock-covers";

export const CourseSchema = z.object({
  id: CuidSchema,
  name: NonEmptyString.max(120, "That name is too long."),
  description: z.string().max(2000, "That description is too long.").nullable(),
  /** An upload URL, a stock path, or "" on rows saved before stock covers. */
  imageUrl: z.string(),
  tutorId: CuidSchema,
  createdAt: DateSchema,
});
export type Course = z.infer<typeof CourseSchema>;

/**
 * Create input. The form supplies an `imageUrl` (already uploaded via the
 * blob client, or a stock cover path from lib/stock-covers) plus an optional list of student IDs to enrol on creation.
 * `tutorId` is NOT in the input — the action infers it from the session.
 */
/** Curriculum, subject and grade (#216); cleaned with curriculumToStore on save. */
export const CourseCurriculumInputSchema = z.object({
  curriculum: z.enum(["CAPS", "IEB", "OTHER"]).nullable(),
  subject: z.string().max(40).nullable(),
  gradeLevel: z.number().int().min(1).max(12).nullable(),
});

export const CreateCourseSchema = z.object({
  name: NonEmptyString.max(120, "That name is too long."),
  description: z.string().max(2000, "That description is too long.").nullable(),
  imageUrl: CourseCoverSchema,
  studentIds: z.array(CuidSchema).default([]).optional(),
  curriculum: CourseCurriculumInputSchema.optional(),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

/**
 * Update input — `id` is required, all other fields optional.
 * `studentIds`, when supplied, REPLACES the enrolment set (Prisma `set:`).
 */
export const UpdateCourseSchema = z.object({
  id: CuidSchema,
  name: NonEmptyString.max(120, "That name is too long.").optional(),
  description: z.string().max(2000, "That description is too long.").nullable().optional(),
  imageUrl: CourseCoverSchema.optional(),
  studentIds: z.array(CuidSchema).optional(),
  curriculum: CourseCurriculumInputSchema.optional(),
});
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

export const DeleteCourseSchema = z.object({
  id: CuidSchema,
});
export type DeleteCourseInput = z.infer<typeof DeleteCourseSchema>;

export const CourseFilterSchema = z.object({
  tutorId: CuidSchema.optional(),
  search: z.string().trim().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type CourseFilter = z.infer<typeof CourseFilterSchema>;
