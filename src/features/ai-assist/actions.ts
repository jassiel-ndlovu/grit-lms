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
 * Every result is a draft for the tutor to review; nothing is saved here.
 */

import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import { assistStatus, generateQuestions, outlineFromDocument, tidyLessonText } from "./assist";
import { AI_ASSIST_INPUT } from "./limits";
import { QUESTION_TYPES } from "./model";

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
