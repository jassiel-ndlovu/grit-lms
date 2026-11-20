"use server";

/**
 * POPIA rights (design 02, section 8): delete an account, or cancel it.
 * The data export is a download: GET /api/account/export (own data) or
 * /api/account/export?userId=… (a tutor, for a student they teach).
 */

import { z } from "zod";

import { prisma } from "@/lib/db";
import { actionClient, viewerActionClient } from "@/lib/safe-action";
import { canIn, requireViewer, ViewerError, type Viewer } from "@/lib/viewer";
import { can, needsScope } from "@/lib/viewer-core";

import { cancelDeletionByToken, cancelDeletionFor, requestAccountDeletionFor, soleOwnerOf } from "./deletion";

/** For the settings page: whether the viewer can delete now, or must hand over a workspace first. */
export const getAccountDeletionStatus = viewerActionClient
  .schema(z.object({}))
  .action(async () => {
    const viewer = await requireViewer();
    return { soleOwnerOf: await soleOwnerOf(viewer.user.id) };
  });

/** The viewer deletes their own account (14 days to cancel by the emailed link). Signs them out. */
export const requestAccountDeletion = viewerActionClient
  .schema(z.object({ confirm: z.literal("DELETE") }))
  .action(async () => {
    const viewer = await requireViewer();
    return requestAccountDeletionFor(viewer.user.id, { actorUserId: viewer.user.id, workspaceId: viewer.workspace?.id ?? null });
  });

/** From the emailed link (works signed out). */
export const cancelAccountDeletion = actionClient
  .schema(z.object({ token: z.string().min(10).max(200) }))
  .action(async ({ parsedInput }) => ({ cancelled: await cancelDeletionByToken(parsedInput.token) }));

/** A tutor deletes a student's (or a parent's) account on the parent's request, or cancels that. */
async function assertManagesAccount(viewer: Viewer, userId: string) {
  if (!viewer.workspace || !can(viewer, "learners.invite")) throw new ViewerError("FORBIDDEN");
  const ws = viewer.workspace.id;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      platformRole: true, memberships: { where: { status: "ACTIVE" }, select: { id: true } },
      learners: { where: { workspaceId: ws }, select: { enrollments: { where: { endedAt: null }, select: { courseId: true } } } },
      guardianOf: { where: { status: "ACTIVE" }, select: { student: { select: { learners: { where: { workspaceId: ws }, select: { enrollments: { where: { endedAt: null }, select: { courseId: true } } } } } } } },
    },
  });
  if (!target || target.platformRole === "NEXA_ADMIN" || target.memberships.length) throw new ViewerError("FORBIDDEN");
  const courseIds = [...target.learners, ...target.guardianOf.flatMap((g) => g.student.learners)].flatMap((l) => l.enrollments.map((e) => e.courseId));
  const inWorkspace = target.learners.length > 0 || target.guardianOf.some((g) => g.student.learners.length > 0);
  if (!inWorkspace) throw new ViewerError("FORBIDDEN");
  if (needsScope(viewer, "learners.invite")) {
    for (const c of courseIds) if (await canIn(viewer, "learners.invite", { courseId: c })) return ws;
    throw new ViewerError("FORBIDDEN");
  }
  return ws;
}

export const requestStudentAccountDeletion = viewerActionClient
  .schema(z.object({ userId: z.string().min(1), confirm: z.literal("DELETE") }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const ws = await assertManagesAccount(viewer, parsedInput.userId);
    return requestAccountDeletionFor(parsedInput.userId, { actorUserId: viewer.user.id, workspaceId: ws });
  });

export const cancelStudentAccountDeletion = viewerActionClient
  .schema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const ws = await assertManagesAccount(viewer, parsedInput.userId);
    return cancelDeletionFor(parsedInput.userId, viewer.user.id, ws);
  });
