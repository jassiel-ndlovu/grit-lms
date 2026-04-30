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

/* ─── Delete + ownership inputs ────────────────────────────────────────── */

export const DeleteTestSchema = z.object({ id: CuidSchema });
export type DeleteTestInput = z.infer<typeof DeleteTestSchema>;

/* ─── Test creation/update with embedded questions ──────────────────────── */

/**
 * Question shape accepted by createTest / updateTest. Supports nested
 * sub-questions via a recursive `subQuestions` array. The action turns the
 * tree into a flat insert with parentId pointers.
 */
export type CreateTestQuestionTree = {
  question: string;
  type: z.infer<typeof QuestionTypeSchema>;
  points: number;
  order?: number;
  options?: string[];
  answer?: unknown;
  language?: string | null;
  matchPairs?: unknown;
  reorderItems?: string[];
  blankCount?: number | null;
  subQuestions?: CreateTestQuestionTree[];
};

export const CreateTestQuestionTreeSchema: z.ZodType<CreateTestQuestionTree> =
  z.lazy(() =>
    z.object({
      question: NonEmptyString,
      type: QuestionTypeSchema,
      points: z.number().int().nonnegative(),
      order: z.number().int().optional(),
      options: z.array(z.string()).default([]),
      answer: z.unknown().optional(),
      language: z.string().nullable().optional(),
      matchPairs: z.unknown().optional(),
      reorderItems: z.array(z.string()).default([]),
      blankCount: z.number().int().positive().nullable().optional(),
      subQuestions: z.array(CreateTestQuestionTreeSchema).default([]),
    }),
  );

/**
 * Create a test with its question tree in one atomic action.
 *
 * `isActive` is intentionally exposed so the form can save drafts without
 * triggering a TEST_CREATED notification fan-out.
 */
export const CreateTestWithQuestionsSchema = z.object({
  title: NonEmptyString.max(200),
  description: z.string().max(5000).default(""),
  preTestInstructions: z.string().max(5000).nullable().default(null),
  courseId: CuidSchema,
  dueDate: DateSchema,
  timeLimit: z.number().int().positive().nullable().default(null),
  totalPoints: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(false),
  questions: z.array(CreateTestQuestionTreeSchema).default([]),
});
export type CreateTestWithQuestionsInput = z.infer<
  typeof CreateTestWithQuestionsSchema
>;

/**
 * Update a test + replace its question set in one atomic action.
 *
 * `questions`, when supplied, REPLACES the test's question tree. Pass an
 * empty array to clear all questions. Omitting the field keeps existing.
 */
export const UpdateTestWithQuestionsSchema = z.object({
  id: CuidSchema,
  title: NonEmptyString.max(200).optional(),
  description: z.string().max(5000).optional(),
  preTestInstructions: z.string().max(5000).nullable().optional(),
  dueDate: DateSchema.optional(),
  timeLimit: z.number().int().positive().nullable().optional(),
  totalPoints: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  questions: z.array(CreateTestQuestionTreeSchema).optional(),
});
export type UpdateTestWithQuestionsInput = z.infer<
  typeof UpdateTestWithQuestionsSchema
>;

/* ─── TestSubmission inputs ─────────────────────────────────────────────── */

/** Begin a fresh submission for the calling student (status = IN_PROGRESS). */
export const StartTestSubmissionSchema = z.object({
  testId: CuidSchema,
});
export type StartTestSubmissionInput = z.infer<
  typeof StartTestSubmissionSchema
>;

/** Submit answers — flips the submission to SUBMITTED. Tutor grades next. */
export const SubmitTestAnswersSchema = z.object({
  submissionId: CuidSchema,
  answers: z.unknown(),
});
export type SubmitTestAnswersInput = z.infer<typeof SubmitTestAnswersSchema>;

/* ─── Grading inputs (tutor) ────────────────────────────────────────────── */

/**
 * Grade a test submission. Creates or updates the Grade row (one per
 * submission via unique constraint) and replaces all QuestionGrade rows
 * for the submission in one transaction.
 */
export const GradeTestSubmissionSchema = z.object({
  submissionId: CuidSchema,
  score: z.number().nonnegative(),
  outOf: z.number().positive(),
  feedback: z.string().max(5000).nullable().default(null),
  questionGrades: z
    .array(
      z.object({
        questionId: CuidSchema.nullable(),
        score: z.number().nonnegative(),
        outOf: z.number().positive(),
        feedback: z.string().max(2000).nullable().default(null),
      }),
    )
    .default([]),
});
export type GradeTestSubmissionInput = z.infer<
  typeof GradeTestSubmissionSchema
>;
