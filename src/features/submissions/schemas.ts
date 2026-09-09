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
  memoFileUrls: z.array(UrlSchema).default([]),
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

import { CreateAttachmentSchema } from "../lessons/schemas";

/* ─── Delete inputs ─────────────────────────────────────────────────────── */

export const DeleteSubmissionSchema = z.object({ id: CuidSchema });
export type DeleteSubmissionInput = z.infer<typeof DeleteSubmissionSchema>;

/* ─── Submission CRUD inputs (tutor) ───────────────────────────────────── */

/**
 * Tutor creates an assignment. `descriptionFiles` are description-time
 * attachments (e.g. PDF prompt) — not the student's submitted files.
 */
export const CreateSubmissionInputSchema = z.object({
  title: NonEmptyString.max(200),
  description: z.string().max(10000).default(""),
  courseId: CuidSchema,
  dueDate: DateSchema,
  lastDueDate: DateSchema.nullable().default(null),
  fileType: z.string().default("PDF"),
  maxAttempts: z.number().int().positive().nullable().default(null),
  totalPoints: z.number().int().nonnegative().default(1),
  isActive: z.boolean().default(true),
  descriptionFiles: z.array(UrlSchema).default([]),
  memoFileUrls: z.array(UrlSchema).default([]),
});
export type CreateSubmissionInputType = z.infer<
  typeof CreateSubmissionInputSchema
>;

export const UpdateSubmissionInputSchema =
  CreateSubmissionInputSchema.partial().extend({
    id: CuidSchema,
  });
export type UpdateSubmissionInputType = z.infer<
  typeof UpdateSubmissionInputSchema
>;

/* ─── SubmissionEntry inputs (student) ─────────────────────────────────── */

/**
 * Student submits an assignment entry. `fileUrl` carries the uploaded
 * file URLs (uploaded out-of-band via /api/blob/upload-token).
 */
export const SubmitSubmissionEntrySchema = z.object({
  submissionId: CuidSchema,
  fileUrl: z.array(UrlSchema).default([]),
});
export type SubmitSubmissionEntryInput = z.infer<
  typeof SubmitSubmissionEntrySchema
>;

/* ─── Grading inputs (tutor) ────────────────────────────────────────────── */

export const GradeSubmissionEntrySchema = z.object({
  entryId: CuidSchema,
  score: z.number().nonnegative(),
  outOf: z.number().positive(),
  feedback: z.string().max(5000).nullable().default(null),
});
export type GradeSubmissionEntryInput = z.infer<
  typeof GradeSubmissionEntrySchema
>;

/**
 * Per-section grading input. Sections are optional; a tutor who just wants
 * to drop a total score can send an empty `sections` array and only fill
 * out `score` / `outOf` / `feedback`.
 *
 * Each section is stored as a QuestionGrade row where:
 *   - questionId  = `sec:${index}` (namespace-scoped so it won't collide with
 *                   any real question id even if this table starts serving
 *                   both submission entries and test submissions)
 *   - feedback    = JSON-encoded `{ title, remarks, memoFileUrl }` — see
 *                   `parseSectionFeedback` / `stringifySectionFeedback` in
 *                   features/submissions/lib/sections.ts
 */
export const SubmissionSectionSchema = z.object({
  title: NonEmptyString.max(200, "Section title too long"),
  remarks: z.string().max(5000, "Remarks too long").default(""),
  score: z.number().nonnegative(),
  outOf: z.number().positive(),
  memoFileUrl: UrlSchema.nullable().default(null),
});
export type SubmissionSection = z.infer<typeof SubmissionSectionSchema>;

export const GradeSubmissionEntryWithSectionsSchema = z.object({
  entryId: CuidSchema,
  /** Total score for the entry — usually the sum of section scores. */
  score: z.number().nonnegative(),
  outOf: z.number().positive(),
  /** Overall feedback shown alongside the sections. */
  feedback: z.string().max(5000).nullable().default(null),
  /** Optional per-section breakdown; empty = mark with a single total. */
  sections: z.array(SubmissionSectionSchema).default([]),
});
export type GradeSubmissionEntryWithSectionsInput = z.infer<
  typeof GradeSubmissionEntryWithSectionsSchema
>;

// Re-export to suppress unused-import warnings when forms only need shapes.
export { CreateAttachmentSchema };
