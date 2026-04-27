/**
 * Grade schemas — final grades on submissions/tests plus per-question grades.
 *
 * Grade has a 1:1 relationship with either a SubmissionEntry or a
 * TestSubmission via the matching nullable FK; exactly one should be set.
 * The refine() below enforces that invariant at the input layer.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
} from "../shared/primitives";

export const GradeSchema = z
  .object({
    id: CuidSchema,
    studentId: CuidSchema,
    courseId: CuidSchema,
    type: NonEmptyString,
    title: NonEmptyString.max(200),
    score: z.number().nonnegative(),
    outOf: z.number().positive(),
    finalComments: z.string().max(5000).nullable(),
    submissionEntryId: CuidSchema.nullable(),
    testSubmissionId: CuidSchema.nullable(),
    createdAt: DateSchema,
    updatedAt: DateSchema,
  })
  .refine(
    (g) =>
      Boolean(g.submissionEntryId) !== Boolean(g.testSubmissionId),
    {
      message: "Grade must reference exactly one of submissionEntry or testSubmission",
      path: ["submissionEntryId"],
    },
  );
export type Grade = z.infer<typeof GradeSchema>;

export const QuestionGradeSchema = z.object({
  id: CuidSchema,
  questionId: CuidSchema.nullable(),
  score: z.number().nonnegative(),
  outOf: z.number().positive(),
  feedback: z.string().nullable(),
  testSubmissionId: CuidSchema.nullable(),
  submissionEntryId: CuidSchema.nullable(),
  createdAt: DateSchema,
  updatedAt: DateSchema,
});
export type QuestionGrade = z.infer<typeof QuestionGradeSchema>;
