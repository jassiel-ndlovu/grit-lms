/**
 * Student schemas. Student is the application-level identity for learners,
 * separate from the auth-level User model.
 */

import { z } from "zod";

import {
  CuidSchema,
  EmailSchema,
  NonEmptyString,
  OptionalUrlSchema,
} from "../shared/primitives";

export const StudentSchema = z.object({
  id: CuidSchema,
  fullName: NonEmptyString.max(120),
  email: EmailSchema,
  imageUrl: OptionalUrlSchema,
});
export type Student = z.infer<typeof StudentSchema>;

export const CreateStudentSchema = StudentSchema.omit({ id: true });
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = CreateStudentSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
