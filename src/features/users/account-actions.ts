"use server";

/**
 * Tutor-created accounts (design 02, section 5.1; ux/01, sections 6 and 7).
 * Sign-in codes are returned once, for the tutor to hand over; they are
 * never stored in plain text or emailed.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { canIn, requireViewer, ViewerError, type Viewer } from "@/lib/viewer";
import { can, needsScope } from "@/lib/viewer-core";
import { assertWorkspaceManages, UserError } from "@/lib/user-error";

import { createStudentAccountFor, issueSignInCodeFor, linkParentFor, parentsOf, revokeGuardianshipFor, setOwnPasswordFor } from "./accounts";

function workspaceOf(viewer: Viewer): string {
  if (viewer.persona !== "staff" && viewer.persona !== "admin") throw new ViewerError("FORBIDDEN");
  if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
  return viewer.workspace.id;
}

/** The viewer may manage this learner: same workspace, and (for a tutor) enrolled in a course they teach. */
async function assertManagesLearner(viewer: Viewer, learnerId: string, permission: "learners.invite" | "guardians.link") {
  const ws = workspaceOf(viewer);
  if (!can(viewer, permission)) throw new ViewerError("FORBIDDEN");
  const learner = await prisma.learner.findFirst({ where: { id: learnerId, workspaceId: ws }, select: { userId: true, enrollments: { where: { endedAt: null }, select: { courseId: true } } } });
  if (!learner) throw new ViewerError("FORBIDDEN");
  if (needsScope(viewer, permission)) {
    let ok = false;
    for (const e of learner.enrollments) if (await canIn(viewer, permission, { courseId: e.courseId })) { ok = true; break; }
    if (!ok) throw new ViewerError("FORBIDDEN");
  }
  return { workspaceId: ws, learnerUserId: learner.userId };
}

/** Creates a student and returns their username and one-time sign-in code (shown once). */
export const createStudentAccount = writableViewerActionClient
  .schema(z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200).nullable().optional(),
    username: z.string().trim().max(30).optional(),
    isMinor: z.boolean().default(true),
    courseIds: z.array(z.string().min(1)).max(20).default([]),
    consentAttested: z.boolean().default(false),
  }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const ws = workspaceOf(viewer);
    if (!can(viewer, "learners.invite")) throw new ViewerError("FORBIDDEN");
    if (needsScope(viewer, "learners.invite")) {
      if (parsedInput.courseIds.length === 0) throw new UserError("Choose at least one of your courses");
      for (const courseId of parsedInput.courseIds) if (!(await canIn(viewer, "learners.invite", { courseId }))) throw new ViewerError("FORBIDDEN");
    }
    const r = await createStudentAccountFor(viewer.user.id, ws, parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

/** A new sign-in code for a student, or for a parent of one, whom the viewer manages. Not for staff accounts. */
export const issueSignInCode = writableViewerActionClient
  .schema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput: { userId } }) => {
    const viewer = await requireViewer();
    const ws = workspaceOf(viewer);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, managedByWorkspaceId: true, memberships: { where: { status: "ACTIVE" }, select: { id: true } }, learners: { where: { workspaceId: ws }, select: { id: true } }, guardianOf: { where: { status: "ACTIVE" }, select: { student: { select: { learners: { where: { workspaceId: ws }, select: { id: true } } } } } } },
    });
    if (!target || target.platformRole === "NEXA_ADMIN" || target.memberships.length) throw new ViewerError("FORBIDDEN");
    const learnerIds = [...target.learners.map((l) => l.id), ...target.guardianOf.flatMap((g) => g.student.learners.map((l) => l.id))];
    let allowed = false;
    for (const id of learnerIds) {
      try {
        await assertManagesLearner(viewer, id, target.learners.length ? "learners.invite" : "guardians.link");
        allowed = true;
        break;
      } catch {
        // try the next
      }
    }
    if (!allowed) throw new ViewerError("FORBIDDEN");
    assertWorkspaceManages(target, ws);
    return issueSignInCodeFor(viewer.user.id, ws, userId);
  });

export const linkParent = writableViewerActionClient
  .schema(z.object({
    learnerId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200).nullable().optional(),
    relationship: z.enum(["PARENT", "GUARDIAN", "OTHER"]).default("PARENT"),
  }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const { workspaceId } = await assertManagesLearner(viewer, parsedInput.learnerId, "guardians.link");
    const r = await linkParentFor({ userId: viewer.user.id, name: viewer.user.name }, workspaceId, parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const listParents = viewerActionClient
  .schema(z.object({ learnerId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const { learnerUserId } = await assertManagesLearner(viewer, parsedInput.learnerId, "guardians.link");
    return parentsOf(learnerUserId);
  });

export const revokeGuardianship = writableViewerActionClient
  .schema(z.object({ guardianshipId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const ws = workspaceOf(viewer);
    const g = await prisma.guardianship.findUnique({ where: { id: parsedInput.guardianshipId }, select: { student: { select: { learners: { where: { workspaceId: ws }, select: { id: true } } } } } });
    const learnerId = g?.student.learners[0]?.id;
    if (!learnerId) throw new ViewerError("FORBIDDEN");
    await assertManagesLearner(viewer, learnerId, "guardians.link");
    const r = await revokeGuardianshipFor(viewer.user.id, ws, parsedInput.guardianshipId);
    revalidatePath("/dashboard", "layout");
    return r;
  });

/** The first password after signing in with a code (viewer.user.mustChangePassword). */
export const setOwnPassword = viewerActionClient
  .schema(z.object({ newPassword: z.string().min(1).max(200) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const r = await setOwnPasswordFor(viewer.user.id, parsedInput.newPassword);
    revalidatePath("/", "layout");
    return r;
  });
