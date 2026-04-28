/**
 * Submission schemas — open-ended assignment submissions (separate from
 * Test submissions, which live under features/assessments).
 *
 * SubmissionEntry uses an [submissionId, studentId] uniqueness constraint to
 * enforce one in-progress entry per student. If the entity needs more than
 * one attempt, attemptNumber is incremented.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  UrlSchema,
} from "../shared/primitives";
import { SubmissionStatusSchema } from "../shared/enums";

export const SubmissionSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  description: z.string().max(5000),
  courseId: CuidSchema,
  dueDate: DateSchema,
  lastDueDate: DateSchema.nullable(),
  fileType: z.string(),
  maxAttempts: z.number().int().positive().nullable(),
  totalPoints: z.number().int().nonnegative().default(1),
  isActive: z.boolean().nullable().default(true),
  descriptionFiles: z.array(UrlSchema).default([]),
  createdAt: DateSchema,
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const CreateSubmissionSchema = SubmissionSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

export const UpdateSubmissionSchema = CreateSubmissionSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateSubmissionInput = z.infer<typeof UpdateSubmissionSchema>;

/* ─── SubmissionEntry ───────────────────────────────────────────────────── */

export const SubmissionEntrySchema = z.object({
  id: CuidSchema,
  studentId: CuidSchema,
  submissionId: CuidSchema,
  submittedAt: DateSchema,
  attemptNumber: z.number().int().positive(),
  status: SubmissionStatusSchema,
  feedback: z.string(),
  fileUrl: z.array(UrlSchema).default([]),
});
export type SubmissionEntry = z.infer<typeof SubmissionEntrySchema>;

export const CreateSubmissionEntrySchema = SubmissionEntrySchema.omit({
  id: true,
});
export type CreateSubmissionEntryInput = z.infer<
  typeof CreateSubmissionEntrySchema
>;
