"use server";

/**
 * The course study assistant (#216 phase 3, Pro). Contract: viewer.md,
 * "Study assistant". Students ask (parents may, for a child); tutors read.
 */

import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import * as s from "./study";

const id = z.string().min(1).max(64);
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;

export const getStudyStatus = viewerActionClient
  .schema(z.object({ courseId: id, studentUserId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => s.studyStatus(v(ctx), parsedInput));

export const askStudyAction = writableViewerActionClient
  .schema(z.object({ courseId: id, question: z.string().max(1500), chatId: id.optional(), studentUserId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => s.askStudy(v(ctx), parsedInput));

export const listMyStudyChats = viewerActionClient
  .schema(z.object({ courseId: id, studentUserId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => s.myStudyChats(v(ctx), parsedInput));

export const getStudyChatAction = viewerActionClient
  .schema(z.object({ chatId: id }))
  .action(async ({ parsedInput, ctx }) => s.getStudyChat(v(ctx), parsedInput));

export const listCourseStudyChats = viewerActionClient
  .schema(z.object({ courseId: id, flaggedOnly: z.boolean().optional(), limit: z.number().int().min(1).max(300).optional() }))
  .action(async ({ parsedInput, ctx }) => s.courseStudyChats(v(ctx), parsedInput));

export const clearStudyFlagAction = writableViewerActionClient
  .schema(z.object({ chatId: id }))
  .action(async ({ parsedInput, ctx }) => s.clearStudyFlag(v(ctx), parsedInput));
