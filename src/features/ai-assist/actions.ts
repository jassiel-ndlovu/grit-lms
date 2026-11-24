"use server";

/**
 * AI help for tutors (#216 phase 2: Plus limited, Pro more). Contract:
 * viewer.md, "AI help for tutors". Staff with courses.edit on the course.
 *
 *   getAiAssistStatus       what's available and left this month
 *   generateQuestionsAction draft questions from a lesson or topic
 *   outlineFromDocumentAction a course outline from text or a PDF
 *   tidyTextAction          tidy or simplify lesson text
 *
 * Pro only (#216 phase 3):
 *   lessonsFromDocumentAction  lessons, tests and assignments from a document
 *   feedbackDraftAction        feedback on a student's long answer
 *   reportCommentsAction       term-report comments for a class
 *   curriculumGapsAction       uncovered curriculum topics and ordering ideas
 *
 * Every result is a draft for the tutor to review; nothing is saved here.
 */

import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import { assistStatus, generateQuestions, outlineFromDocument, tidyLessonText } from "./assist";
import { AI_ASSIST_INPUT } from "./limits";
import { QUESTION_TYPES } from "./model";
import { curriculumGaps, diagram, feedbackDraft, lessonsFromDocument, reportCommentDrafts, sessionNotes } from "./pro";

const id = z.string().min(1).max(64);
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;

export const getAiAssistStatus = viewerActionClient
  .schema(z.object({ courseId: id }))
  .action(async ({ parsedInput, ctx }) => assistStatus(v(ctx), parsedInput));

export const generateQuestionsAction = writableViewerActionClient
  .schema(z.object({
    courseId: id,
    lessonId: id.optional(),
    topic: z.string().max(300).optional(),
    count: z.number().int().min(1).max(AI_ASSIST_INPUT.maxQuestions),
    types: z.array(z.enum(QUESTION_TYPES)).min(1).max(QUESTION_TYPES.length),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  }))
  .action(async ({ parsedInput, ctx }) => generateQuestions(v(ctx), parsedInput));

export const outlineFromDocumentAction = writableViewerActionClient
  .schema(z.object({ courseId: id, text: z.string().max(AI_ASSIST_INPUT.documentChars).optional(), fileUrl: z.string().url().max(1000).optional() }))
  .action(async ({ parsedInput, ctx }) => outlineFromDocument(v(ctx), parsedInput));

export const tidyTextAction = writableViewerActionClient
  .schema(z.object({ courseId: id, text: z.string().max(AI_ASSIST_INPUT.tidyChars), mode: z.enum(["tidy", "simplify"]), readingLevel: z.string().max(60).optional() }))
  .action(async ({ parsedInput, ctx }) => tidyLessonText(v(ctx), parsedInput));

export const lessonsFromDocumentAction = writableViewerActionClient
  .schema(z.object({
    courseId: id,
    text: z.string().max(AI_ASSIST_INPUT.documentChars).optional(),
    fileUrl: z.string().url().max(1000).optional(),
    lessons: z.number().int().min(1).max(8).default(4),
    tests: z.number().int().min(0).max(2).default(1),
    questionsPerTest: z.number().int().min(1).max(10).default(8),
    assignments: z.number().int().min(0).max(2).default(0),
    focus: z.string().max(300).optional(),
  }))
  .action(async ({ parsedInput, ctx }) => lessonsFromDocument(v(ctx), parsedInput));

export const feedbackDraftAction = writableViewerActionClient
  .schema(z.object({
    courseId: id,
    question: z.string().min(1).max(6000),
    answer: z.string().max(AI_ASSIST_INPUT.answerChars),
    memo: z.string().max(6000).optional(),
    maxPoints: z.number().positive().max(1000).optional(),
    tone: z.enum(["warm", "direct"]).optional(),
    studentUserId: id.optional(),
  }))
  .action(async ({ parsedInput, ctx }) => feedbackDraft(v(ctx), parsedInput));

export const reportCommentsAction = writableViewerActionClient
  .schema(z.object({
    courseId: id,
    from: z.coerce.date(),
    to: z.coerce.date(),
    term: z.string().min(1).max(80),
    learnerIds: z.array(id).max(AI_ASSIST_INPUT.reportStudents).optional(),
    notes: z.record(z.string(), z.string().max(300)).optional(),
    tone: z.enum(["warm", "formal"]).optional(),
  }))
  .action(async ({ parsedInput, ctx }) => reportCommentDrafts(v(ctx), parsedInput));

export const curriculumGapsAction = writableViewerActionClient
  .schema(z.object({ courseId: id }))
  .action(async ({ parsedInput, ctx }) => curriculumGaps(v(ctx), parsedInput));

export const sessionNotesAction = writableViewerActionClient
  .schema(z.object({ courseId: id, transcript: z.string().max(300_000).optional(), fileUrl: z.string().url().max(1000).optional(), title: z.string().max(120).optional() }))
  .action(async ({ parsedInput, ctx }) => sessionNotes(v(ctx), parsedInput));

export const diagramAction = writableViewerActionClient
  .schema(z.object({ courseId: id, description: z.string().max(2000), style: z.enum(["simple", "detailed"]).optional() }))
  .action(async ({ parsedInput, ctx }) => diagram(v(ctx), parsedInput));
