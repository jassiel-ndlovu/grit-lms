/**
 * Course event schemas — lectures, exams, meetings, etc. attached to a course.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  OptionalUrlSchema,
} from "../shared/primitives";
import { EventTypeSchema } from "../shared/enums";

export const CourseEventSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  description: z.string(),
  type: EventTypeSchema,
  date: DateSchema,
  location: z.string().max(200).nullable(),
  duration: z.number().int().positive().nullable(),
  link: OptionalUrlSchema,
  courseId: CuidSchema,
  createdAt: DateSchema,
});
export type CourseEvent = z.infer<typeof CourseEventSchema>;

export const CreateCourseEventSchema = CourseEventSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateCourseEventInput = z.infer<typeof CreateCourseEventSchema>;

export const UpdateCourseEventSchema = CreateCourseEventSchema.partial().extend(
  {
    id: CuidSchema,
  },
);
export type UpdateCourseEventInput = z.infer<typeof UpdateCourseEventSchema>;
