/**
 * Loaders for the study assistant and credits screens, over A's
 * features/study and features/ai-credits. A's functions check who may see
 * what; the pages turn their refusals into a 404.
 */

import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { myStudyCredits } from "@/features/ai-credits/topups";
import { isBillingEnabled } from "@/features/billing/errors";
import { hasService } from "@/features/billing/services";
import { STUDY_SERVICE, studyAssistantConfigured } from "@/features/study/study";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { getViewer, ViewerError, type Viewer } from "@/lib/viewer";

/**
 * Whether the course's assistant shows in its tabs: on the plan, set up, and
 * billing on (students pay for their answers, so it opens with billing).
 */
export const hasStudyAssistant = cache(async (courseId: string): Promise<boolean> => {
  if (!isBillingEnabled() || !studyAssistantConfigured()) return false;
  const viewer = await getViewer();
  return viewer ? hasService(viewer, courseId, STUDY_SERVICE) : false;
});

/** Runs one of A's study functions; "not yours" and "not there" are a 404. */
export async function orNotFound<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ViewerError || e instanceof UserError) notFound();
    throw e;
  }
}

/** The course pages' bit of a course, whatever the viewer's role. */
export const studyCourse = cache((courseId: string) =>
  prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, workspaceId: true, workspace: { select: { name: true } } },
  }),
);

export interface StudyAccount {
  studentUserId: string;
  name: string;
  workspace: { id: string; name: string };
  /** The courses these credits work on. */
  courses: Array<{ id: string; name: string }>;
  balance: number;
  purchases: Array<{ credits: number; boughtAt: Date; expiresAt: Date | null; expired: boolean }>;
  offer: { validityDays: number; packs: Array<{ priceCents: number; credits: number }> };
  /** Whether the viewer may buy for this student. */
  payer: boolean;
}

/** Courses of a student in a workspace where the assistant is on. */
async function assistantCourses(studentUserId: string, workspaceId: string) {
  const rows = await prisma.course.findMany({
    where: { workspaceId, enrollments: { some: { endedAt: null, learner: { userId: studentUserId } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const on = await Promise.all(rows.map((c) => hasStudyAssistant(c.id)));
  return rows.filter((_, i) => on[i]);
}

/** The viewer's own study credits, or each child's, per organisation. */
export async function studyAccounts(viewer: Viewer, onlyChild?: string | null): Promise<StudyAccount[]> {
  const who =
    viewer.persona === "learner" && viewer.workspace
      ? [
          {
            userId: viewer.user.id,
            name: viewer.user.name,
            workspace: { id: viewer.workspace.id, name: viewer.workspace.name },
            payer: viewer.learner?.paymentVisible ?? false,
          },
        ]
      : viewer.persona === "guardian"
        ? viewer.children
            .filter((c) => !onlyChild || c.userId === onlyChild)
            .flatMap((c) => c.workspaces.map((w) => ({ userId: c.userId, name: c.name, workspace: w, payer: true })))
        : [];
  const rows = await Promise.all(
    who.map(async (w): Promise<StudyAccount | null> => {
      const [courses, credits] = await Promise.all([
        assistantCourses(w.userId, w.workspace.id),
        myStudyCredits(viewer, { studentUserId: w.userId, workspaceId: w.workspace.id }).catch((e) => {
          // A child who has left that organisation has no credits there.
          if (e instanceof UserError || e instanceof ViewerError) return null;
          throw e;
        }),
      ]);
      if (!credits || (courses.length === 0 && credits.purchases.length === 0 && credits.balance === 0)) return null;
      return { studentUserId: w.userId, name: w.name, workspace: w.workspace, courses, payer: w.payer, ...credits };
    }),
  );
  return rows.filter((r) => r !== null);
}

/** Whether a child has a course with the assistant, for the link on their page. */
export async function childHasAssistant(viewer: Viewer, childUserId: string): Promise<boolean> {
  if (!isBillingEnabled()) return false;
  const child = viewer.children.find((c) => c.userId === childUserId);
  const lists = await Promise.all((child?.workspaces ?? []).map((w) => assistantCourses(childUserId, w.id)));
  return lists.some((l) => l.length > 0);
}
