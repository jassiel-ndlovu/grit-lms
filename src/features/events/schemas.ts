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
import { EventTypeSchema, RepeatFrequencySchema } from "../shared/enums";

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

  /* Recurrence - see features/events/lib/recurrence.ts for the expansion. */
  repeatFrequency: RepeatFrequencySchema.default("NONE"),
  /** Every N days/weeks/months/years. */
  repeatInterval: z.number().int().min(1).max(52).default(1),
  /** WEEKLY only; 0 = Sunday .. 6 = Saturday. Empty = start date's weekday. */
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  /** Series end date, or null for open-ended. */
  repeatUntil: DateSchema.nullable().default(null),
  /** Total occurrences including the first, or null for unlimited. */
  repeatCount: z.number().int().min(1).max(365).nullable().default(null),
});
export type CourseEvent = z.infer<typeof CourseEventSchema>;

export const CreateCourseEventSchema = CourseEventSchema.omit({
  id: true,
  createdAt: true,
})
  // A series can end on a date OR after N occurrences, not both - two
  // competing end conditions would make "when does this stop?" ambiguous
  // for the tutor and for expandOccurrences.
  .refine(
    (v) => !(v.repeatUntil != null && v.repeatCount != null),
    {
      message: "Choose either an end date or a number of occurrences, not both",
      path: ["repeatUntil"],
    },
  )
  // Ending/counting only mean something for a repeating event.
  .refine(
    (v) =>
      v.repeatFrequency !== "NONE" ||
      (v.repeatUntil == null && v.repeatCount == null),
    {
      message: "Set a repeat frequency before adding an end condition",
      path: ["repeatFrequency"],
    },
  )
  .refine(
    (v) => v.repeatUntil == null || v.repeatUntil.getTime() >= v.date.getTime(),
    { message: "The series must end on or after it starts", path: ["repeatUntil"] },
  );
export type CreateCourseEventInput = z.infer<typeof CreateCourseEventSchema>;

// `.partial()` is unavailable on a refined schema, so the update shape is
// built from the raw object and re-refined where it still makes sense.
export const UpdateCourseEventSchema = CourseEventSchema.omit({
  id: true,
  createdAt: true,
})
  .partial()
  .extend({ id: CuidSchema })
  .refine(
    (v) => !(v.repeatUntil != null && v.repeatCount != null),
    {
      message: "Choose either an end date or a number of occurrences, not both",
      path: ["repeatUntil"],
    },
  );
export type UpdateCourseEventInput = z.infer<typeof UpdateCourseEventSchema>;
