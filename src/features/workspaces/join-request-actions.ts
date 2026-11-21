"use server";

/**
 * Course listings and join requests (#206). Contract: viewer.md, section
 * "Join requests". Logic in ./join-requests.ts.
 *
 *   setCourseListed      staff who may edit the course
 *   browseCourses        anyone signed in
 *   requestToJoin        a student for themself, or a parent for a child
 *   cancelJoinRequest    the person who asked
 *   listMyJoinRequests   anyone signed in (their own)
 *   listJoinRequests     staff with learners.invite (scoped for tutors)
 *   approveJoinRequest   staff with learners.invite for that course
 *   declineJoinRequest   the same
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { staffActionClient, viewerActionClient } from "@/lib/safe-action";
import { canIn, ViewerError } from "@/lib/viewer";
import { can, needsScope, type Permission, type Viewer } from "@/lib/viewer-core";

import * as j from "./join-requests";

const id = z.string().min(1).max(64);

/** The workspace, and the membership whose courses bound the action (null: the whole workspace). */
function staffScope(viewer: Viewer, permission: Permission): { workspaceId: string; teachingMembershipId: string | null } {
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, permission)) throw new ViewerError("FORBIDDEN");
  return { workspaceId: viewer.workspace.id, teachingMembershipId: needsScope(viewer, permission) ? (viewer.membership?.id ?? "none") : null };
}

/** For a scoped viewer: they may act on this course (they teach or own it), as canIn decides everywhere else. */
async function assertMayActOn(viewer: Viewer, permission: Permission, courseId: string) {
  if (!(await canIn(viewer, permission, { courseId }))) throw new ViewerError("FORBIDDEN", "You don't teach this course.");
}

export const setCourseListed = staffActionClient
  .schema(z.object({ courseId: id, listed: z.boolean() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const s = staffScope(viewer, "courses.edit");
    await assertMayActOn(viewer, "courses.edit", parsedInput.courseId);
    const r = await j.setCourseListedFor(viewer.user.id, s.workspaceId, parsedInput.courseId, parsedInput.listed);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const browseCourses = viewerActionClient
  .schema(z.object({ q: z.string().max(80).optional(), workspaceId: id.optional(), cursor: id.optional() }))
  .action(async ({ parsedInput }) => j.listListedCourses({ ...parsedInput, take: 24 }));

export const requestToJoin = viewerActionClient
  .schema(z.object({ courseId: id, studentUserId: id.optional(), message: z.string().max(j.JOIN.messageMax).optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const r = await j.requestToJoinFor(viewer.user.id, parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const cancelJoinRequest = viewerActionClient
  .schema(z.object({ requestId: id }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const r = await j.cancelJoinRequestFor(viewer.user.id, parsedInput.requestId);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const listMyJoinRequests = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => j.listMyJoinRequests(viewer.user.id));

export const listJoinRequests = viewerActionClient
  .schema(z.object({ status: z.enum(["PENDING", "APPROVED", "DECLINED", "CANCELLED"]).default("PENDING") }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const s = staffScope(viewer, "learners.invite");
    return j.listJoinRequestsForStaff(s.workspaceId, s.teachingMembershipId, parsedInput.status);
  });

export const approveJoinRequest = staffActionClient
  .schema(z.object({ requestId: id, isMinor: z.boolean(), consentAttested: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const s = staffScope(viewer, "learners.invite");
    const req = await j.joinRequestCourse(s.workspaceId, parsedInput.requestId);
    if (!req) throw new j.JoinRequestError("Request not found");
    await assertMayActOn(viewer, "learners.invite", req.courseId);
    const r = await j.approveJoinRequestFor(viewer.user.id, s.workspaceId, parsedInput.requestId, parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const declineJoinRequest = staffActionClient
  .schema(z.object({ requestId: id, reason: z.string().max(j.JOIN.reasonMax).optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const s = staffScope(viewer, "learners.invite");
    const req = await j.joinRequestCourse(s.workspaceId, parsedInput.requestId);
    if (!req) throw new j.JoinRequestError("Request not found");
    await assertMayActOn(viewer, "learners.invite", req.courseId);
    const r = await j.declineJoinRequestFor(viewer.user.id, s.workspaceId, parsedInput.requestId, parsedInput.reason ?? null);
    revalidatePath("/dashboard", "layout");
    return r;
  });
