"use server";

/**
 * AI-assisted marking actions for B's tutor screens (#150). Each needs
 * `courses.edit` on the test's course (its tutor, or an owner or admin),
 * and the course must have the `ai-marking` service. Suggestions are only
 * suggestions: B saves the mark as today when the tutor accepts or edits.
 */

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasService } from "@/features/billing/services";
import { prisma } from "@/lib/db";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { canIn, requireViewer, ViewerError, type Viewer } from "@/lib/viewer";

import { queueAiMarkingFor, recordTutorActionFor, runAiMarking, suggestionsFor } from "./jobs";
import { aiMarkingConfigured } from "./marker";
import { UserError } from "@/lib/user-error";

async function tutorOfTest(viewer: Viewer, testId: string) {
  const t = await prisma.test.findUnique({ where: { id: testId }, select: { courseId: true } });
  if (!t || !(await canIn(viewer, "courses.edit", { courseId: t.courseId }))) throw new ViewerError("FORBIDDEN");
  return t.courseId;
}

/** Turn AI suggestions on or off for one test. Turning on needs the tutor to confirm they hold parents' consent for this class. */
export const setTestAiMarking = writableViewerActionClient
  .schema(z.object({ testId: z.string().min(1), on: z.boolean(), consentConfirmed: z.boolean().optional() }))
  .action(async ({ parsedInput: { testId, on, consentConfirmed } }) => {
    const viewer = await requireViewer();
    const courseId = await tutorOfTest(viewer, testId);
    if (on) {
      if (!consentConfirmed) throw new UserError("Confirm that you have parents' consent for AI-assisted marking for this class");
      if (!(await hasService(viewer, courseId, "ai-marking"))) throw new UserError("AI-suggested marks are part of the Pro plan for this course");
    }
    await prisma.test.update({ where: { id: testId }, data: { aiMarking: on } });
    revalidatePath("/dashboard", "layout");
    return { aiMarking: on };
  });

/** Queue suggestions for the test's written answers (all, or the given questions) and start marking. */
export const requestAiMarking = writableViewerActionClient
  .schema(z.object({ testId: z.string().min(1), questionIds: z.array(z.string().min(1)).max(100).optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const courseId = await tutorOfTest(viewer, parsedInput.testId);
    if (!aiMarkingConfigured()) throw new UserError("AI-assisted marking isn't set up yet");
    if (!(await hasService(viewer, courseId, "ai-marking"))) throw new UserError("AI-suggested marks are part of the Pro plan for this course");
    const r = await queueAiMarkingFor({ ...parsedInput, requestedByUserId: viewer.user.id });
    if (r.reason === "OFF") throw new UserError("Turn on AI-suggested marks for this test first");
    if (r.queued > 0) after(() => runAiMarking({ limit: 25 }).catch((e) => console.error("[ai-marking] run failed:", (e as Error).message)));
    return { queued: r.queued, skipped: r.skipped };
  });

/** The suggestions for one submission, for the grading form. Poll while any are QUEUED or RUNNING. */
export const getAiSuggestions = viewerActionClient
  .schema(z.object({ testSubmissionId: z.string().min(1) }))
  .action(async ({ parsedInput: { testSubmissionId } }) => {
    const viewer = await requireViewer();
    const sub = await prisma.testSubmission.findUnique({ where: { id: testSubmissionId }, select: { testId: true } });
    if (!sub) throw new ViewerError("FORBIDDEN");
    await tutorOfTest(viewer, sub.testId);
    return suggestionsFor(testSubmissionId);
  });

/** Records what the tutor did with a suggestion. */
export const recordAiSuggestionAction = writableViewerActionClient
  .schema(z.object({ suggestionId: z.string().min(1), action: z.enum(["ACCEPTED", "EDITED", "REJECTED"]), score: z.number().min(0).nullable().optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const s = await prisma.aiMarkSuggestion.findUnique({ where: { id: parsedInput.suggestionId }, select: { testSubmission: { select: { testId: true } } } });
    if (!s) throw new ViewerError("FORBIDDEN");
    await tutorOfTest(viewer, s.testSubmission.testId);
    return recordTutorActionFor(viewer.user.id, parsedInput);
  });
