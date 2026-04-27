/**
 * Tutor schemas. Tutor is the application-level identity for educators,
 * separate from the auth-level User model.
 */

import { z } from "zod";

import {
  CuidSchema,
  EmailSchema,
  NonEmptyString,
  OptionalUrlSchema,
} from "../shared/primitives";

export const TutorSchema = z.object({
  id: CuidSchema,
  fullName: NonEmptyString.max(120),
  email: EmailSchema,
  profileImageUrl: OptionalUrlSchema,
  bio: z.string().max(2000).nullable(),
});
export type Tutor = z.infer<typeof TutorSchema>;

export const CreateTutorSchema = TutorSchema.omit({ id: true });
export type CreateTutorInput = z.infer<typeof CreateTutorSchema>;

export const UpdateTutorSchema = CreateTutorSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateTutorInput = z.infer<typeof UpdateTutorSchema>;
