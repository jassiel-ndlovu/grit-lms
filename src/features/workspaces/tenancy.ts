/**
 * Tenancy writes for courses and enrolments (Agent A). Agent B calls these
 * from createCourse and updateCourse, inside the same transaction that
 * writes the old columns (issue #93, step 1). Design 01, sections 1 and 8.
 *
 * Every helper takes a Prisma transaction client, so the old columns and
 * the new tables change together or not at all. All are idempotent.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import type { Prisma } from "@/generated/prisma";
import type { Viewer } from "@/lib/viewer-core";

import { assertCanAddLearners } from "@/features/billing/caps";
import { SERVICES } from "@/features/billing/catalogue";

import { planEnrollmentChanges } from "./enrollment-plan";
import { mayTeach } from "./teaching";

type Tx = Prisma.TransactionClient;

/** The workspace everyone was migrated into (design 01 §8). */
export const LEGACY_WORKSPACE_ID = "ws_nexa_legacy";

/** The viewer's active workspace, or the legacy one for Nexa admins acting outside a workspace. */
export function workspaceIdFor(viewer: Viewer): string {
  return viewer.workspace?.id ?? LEGACY_WORKSPACE_ID;
}

/** The viewer's membership in `workspaceId`, looked up by user when the viewer carries none. */
async function membershipIdFor(tx: Tx, viewer: Viewer, workspaceId: string): Promise<string | null> {
  if (viewer.membership && !viewer.membership.id.startsWith("legacy_") && viewer.workspace?.id === workspaceId) {
    return viewer.membership.id;
  }
  const m = await tx.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: viewer.user.id } },
    select: { id: true },
  });
  return m?.id ?? null;
}

/**
 * Puts a course in the viewer's workspace and makes the viewer its owner
 * and LEAD staff. Keeps an existing owner. Returns the owner membership id.
 */
export async function setUpCourseTenancy(
  tx: Tx,
  { courseId, viewer }: { courseId: string; viewer: Viewer },
): Promise<{ workspaceId: string; ownerMembershipId: string | null }> {
  const course = await tx.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { workspaceId: true, ownerMembershipId: true },
  });
  const workspaceId = course.workspaceId ?? workspaceIdFor(viewer);
  const ownerMembershipId = course.ownerMembershipId ?? (await membershipIdFor(tx, viewer, workspaceId));

  if (course.workspaceId !== workspaceId || course.ownerMembershipId !== ownerMembershipId) {
    await tx.course.update({ where: { id: courseId }, data: { workspaceId, ownerMembershipId } });
  }
  // An owner or admin of an organisation that switched teaching off owns
  // the course but doesn't teach it (#206); they assign a tutor.
  if (ownerMembershipId && (await mayTeach(tx, ownerMembershipId))) {
    await tx.courseStaff.upsert({
      where: { courseId_membershipId: { courseId, membershipId: ownerMembershipId } },
      create: { courseId, membershipId: ownerMembershipId, role: "LEAD" },
      update: {},
    });
  }
  // A new course starts on Pro (owner decision 2026-11-20): every v1
  // premium service on. The tutor switches services off for Core or Plus.
  if (course.workspaceId == null && workspaceId !== LEGACY_WORKSPACE_ID) {
    await switchOnProServices(tx, { courseId, workspaceId, userId: viewer.user.id });
  }
  return { workspaceId, ownerMembershipId };
}

/** Switches on every v1 premium service for a course that has no service rows yet. */
export async function switchOnProServices(tx: Tx, input: { courseId: string; workspaceId: string; userId: string }) {
  if ((await tx.courseService.count({ where: { courseId: input.courseId } })) > 0) return 0;
  const keys = Object.values(SERVICES).filter((s) => s.kind === "premium" && s.status === "v1").map((s) => s.key);
  const known = await tx.service.findMany({ where: { key: { in: keys } }, select: { key: true } });
  await tx.courseService.createMany({
    data: known.map((k) => ({ workspaceId: input.workspaceId, courseId: input.courseId, serviceKey: k.key, enabled: true, changedByUserId: input.userId })),
    skipDuplicates: true,
  });
  return known.length;
}

/**
 * Makes the course's open enrolments match `studentIds` (Student profile
 * ids, as B's forms hold them). Creates a Learner in the course's workspace
 * for any student without one. Closed rows get `endedAt` and DROPPED.
 */
export async function setCourseEnrollment(
  tx: Tx,
  { courseId, studentIds, at = new Date() }: { courseId: string; studentIds: string[]; at?: Date },
): Promise<{ opened: number; closed: number; unmatched: number }> {
  const course = await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: { workspaceId: true } });
  const workspaceId = course.workspaceId ?? LEGACY_WORKSPACE_ID;

  // Student profile -> user (by userId, falling back to email for unlinked profiles).
  const students = await tx.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, userId: true, email: true },
  });
  const byEmail = new Map(
    (
      await tx.user.findMany({
        where: { email: { in: students.filter((s) => !s.userId).map((s) => s.email) } },
        select: { id: true, email: true },
      })
    ).map((u) => [u.email.toLowerCase(), u.id]),
  );
  const userIds = students
    .map((s) => s.userId ?? byEmail.get(s.email.toLowerCase()) ?? null)
    .filter((id): id is string => id != null);
  const unmatched = studentIds.length - userIds.length;

  // Only students who belong to this workspace can be enrolled (#189); new
  // ones are added with createStudentAccount. The legacy workspace still
  // takes any existing student, as before tenancy.
  if (workspaceId !== LEGACY_WORKSPACE_ID && userIds.length) {
    const members = new Set((await tx.learner.findMany({ where: { workspaceId, userId: { in: userIds } }, select: { userId: true } })).map((l) => l.userId));
    if (userIds.some((u) => !members.has(u))) throw new UserError("One of these students isn't in this organisation. Add them as a student first.");
  }
  // Ensure a Learner in this workspace for each, in three queries whatever
  // the class size (create the missing ones, then read all ids).
  if (userIds.length) {
    await tx.learner.createMany({
      data: userIds.map((userId) => ({ workspaceId, userId })),
      skipDuplicates: true,
    });
  }
  const learnerIds = (
    await tx.learner.findMany({ where: { workspaceId, userId: { in: userIds } }, select: { id: true } })
  ).map((l) => l.id);

  const openRows = await tx.enrollment.findMany({
    where: { courseId, endedAt: null },
    select: { id: true, learnerId: true, startedAt: true },
  });
  const plan = planEnrollmentChanges(openRows, learnerIds);

  if (plan.close.length) {
    await tx.enrollment.updateMany({ where: { id: { in: plan.close } }, data: { endedAt: at, status: "DROPPED" } });
  }
  if (plan.open.length) {
    // A hard-stop student limit (the trial's 20) blocks going over it (design 03, section 6).
    await assertCanAddLearners(tx, workspaceId, plan.open);
    await tx.enrollment.createMany({
      data: plan.open.map((learnerId) => ({ workspaceId, courseId, learnerId, status: "ACTIVE" as const, startedAt: at })),
    });
  }
  return { opened: plan.open.length, closed: plan.close.length, unmatched };
}

/** Creates (or keeps) the Learner row for a new student user in a workspace. */
export async function ensureLearner(tx: Tx, { workspaceId, userId }: { workspaceId: string; userId: string }) {
  return tx.learner.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: { workspaceId, userId },
    update: {},
    select: { id: true },
  });
}
