/**
 * Assessment schemas — covers Tests, TestQuestions, TestSubmissions, Quizzes,
 * and AssessmentCompletions. Grouped under "assessments" because they share
 * the same lifecycle (create -> attempt -> submit -> grade).
 *
 * The TestQuestion schema models the self-relation for nested sub-questions.
 */

import { z } from "zod";

import {
  CuidSchema,
  DateSchema,
  NonEmptyString,
  UrlSchema,
} from "../shared/primitives";
import {
  FileTypeSchema,
  QuestionTypeSchema,
  SubmissionStatusSchema,
} from "../shared/enums";

/* ─── Test ──────────────────────────────────────────────────────────────── */

export const TestSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  description: z.string().max(5000),
  courseId: CuidSchema,
  dueDate: DateSchema,
  isActive: z.boolean().default(true),
  preTestInstructions: z.string().max(5000).nullable(),
  timeLimit: z.number().int().positive().nullable(),
  totalPoints: z.number().int().nonnegative(),
  createdAt: DateSchema,
});
export type Test = z.infer<typeof TestSchema>;

export const CreateTestSchema = TestSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateTestInput = z.infer<typeof CreateTestSchema>;

export const UpdateTestSchema = CreateTestSchema.partial().extend({
  id: CuidSchema,
});
export type UpdateTestInput = z.infer<typeof UpdateTestSchema>;

/* ─── TestQuestion ──────────────────────────────────────────────────────── */

/**
 * Recursive type for nested sub-questions.
 * Zod can't infer types through recursion, so we declare a shape explicitly
 * and use z.lazy() for the recursive field.
 */
export type TestQuestion = {
  id: string;
  testId: string;
  parentId: string | null;
  order: number | null;
  question: string;
  type: z.infer<typeof QuestionTypeSchema>;
  points: number;
  options: string[];
  answer: unknown | null;
  language: string | null;
  matchPairs: unknown | null;
  reorderItems: string[];
  blankCount: number | null;
  createdAt: Date;
  subQuestions: TestQuestion[];
};

export const TestQuestionSchema: z.ZodType<TestQuestion> = z.lazy(() =>
  z.object({
    id: CuidSchema,
    testId: CuidSchema,
    parentId: CuidSchema.nullable(),
    order: z.number().int().nullable(),
    question: NonEmptyString,
    type: QuestionTypeSchema,
    points: z.number().int().nonnegative(),
    options: z.array(z.string()).default([]),
    answer: z.unknown().nullable(),
    language: z.string().nullable(),
    matchPairs: z.unknown().nullable(),
    reorderItems: z.array(z.string()).default([]),
    blankCount: z.number().int().positive().nullable(),
    createdAt: DateSchema,
    subQuestions: z.array(TestQuestionSchema).default([]),
  }),
);

export const CreateTestQuestionSchema = z.object({
  testId: CuidSchema,
  parentId: CuidSchema.nullable().optional(),
  order: z.number().int().optional(),
  question: NonEmptyString,
  type: QuestionTypeSchema,
  points: z.number().int().nonnegative(),
  options: z.array(z.string()).default([]),
  answer: z.unknown().optional(),
  language: z.string().optional(),
  matchPairs: z.unknown().optional(),
  reorderItems: z.array(z.string()).default([]),
  blankCount: z.number().int().positive().optional(),
});
export type CreateTestQuestionInput = z.infer<typeof CreateTestQuestionSchema>;

/* ─── TestSubmission ────────────────────────────────────────────────────── */

export const TestSubmissionSchema = z.object({
  id: CuidSchema,
  testId: CuidSchema,
  studentId: CuidSchema,
  startedAt: DateSchema,
  submittedAt: DateSchema.nullable(),
  answers: z.unknown(),
  score: z.number().nullable(),
  feedback: z.string().nullable(),
  status: SubmissionStatusSchema,
});
export type TestSubmission = z.infer<typeof TestSubmissionSchema>;

export const CreateTestSubmissionSchema = TestSubmissionSchema.omit({
  id: true,
});
export type CreateTestSubmissionInput = z.infer<
  typeof CreateTestSubmissionSchema
>;

/* ─── UploadedFile (test attachments) ───────────────────────────────────── */

export const UploadedFileSchema = z.object({
  id: CuidSchema,
  fileUrl: UrlSchema,
  fileType: FileTypeSchema,
  questionId: CuidSchema,
  submissionId: CuidSchema,
});
export type UploadedFile = z.infer<typeof UploadedFileSchema>;

/* ─── Quiz ──────────────────────────────────────────────────────────────── */

export const QuizSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200),
  courseId: CuidSchema,
  dueDate: DateSchema,
  maxAttempts: z.number().int().positive().nullable(),
  createdAt: DateSchema,
});
export type Quiz = z.infer<typeof QuizSchema>;
