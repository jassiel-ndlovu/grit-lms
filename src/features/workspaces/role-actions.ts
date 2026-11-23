"use server";

/**
 * Roles, branches and teams for B's settings screens (#216 phase 1).
 * Contract: viewer.md, "Roles and branches". Logic in ./roles.ts.
 *
 *   listRoles, createRole, updateRole, deleteRole   members.role
 *   setMemberRole                                    members.role
 *   listBranches                                     teams.manage or members.role
 *   createBranch, renameBranch, deleteBranch         teams.manage
 *   createTeam, updateTeam, deleteTeam, setTeamMember, setCourseTeam   teams.manage
 *
 * Organisations only. Writes are refused in a read-only workspace.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";
import { can, PERMISSIONS, staffScope, type Permission, type Viewer } from "@/lib/viewer-core";

import * as r from "./roles";

const id = z.string().min(1).max(64);
const scope = z.enum(["WORKSPACE", "BRANCHES", "OWN_COURSES"]);
const roleInput = z.object({ name: z.string().max(60), basedOn: z.string().max(40), permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length), scope });

function actorFor(viewer: Viewer, ...needed: Permission[]): r.RoleActor {
  if (!viewer.workspace || viewer.persona !== "staff" || viewer.workspace.kind !== "ORGANISATION") throw new ViewerError("FORBIDDEN");
  if (!needed.some((p) => can(viewer, p))) throw new ViewerError("FORBIDDEN");
  const s = staffScope(viewer);
  return { userId: viewer.user.id, workspaceId: viewer.workspace.id, permissions: viewer.permissions, scope: s, branchIds: s === "BRANCHES" ? (viewer.membership?.branchIds ?? []) : [] };
}

const done = <T,>(v: T): T => {
  revalidatePath("/dashboard", "layout");
  return v;
};

export const listRoles = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => r.listRolesFor(actorFor(viewer, "members.role").workspaceId));

export const createRole = writableViewerActionClient
  .schema(roleInput)
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.createRoleFor(actorFor(viewer, "members.role"), parsedInput)));

export const updateRole = writableViewerActionClient
  .schema(roleInput.extend({ roleId: id }))
  .action(async ({ parsedInput: { roleId, ...input }, ctx: { viewer } }) => done(await r.updateRoleFor(actorFor(viewer, "members.role"), roleId, input)));

export const deleteRole = writableViewerActionClient
  .schema(z.object({ roleId: id }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.deleteRoleFor(actorFor(viewer, "members.role"), parsedInput.roleId)));

export const setMemberRole = writableViewerActionClient
  .schema(z.object({ membershipId: id, roleKey: z.string().min(1).max(80), branchIds: z.array(id).max(100).optional() }))
  .action(async ({ parsedInput: { membershipId, ...input }, ctx: { viewer } }) => done(await r.setMemberRoleFor(actorFor(viewer, "members.role"), membershipId, input)));

export const listBranches = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => r.listBranchesFor(actorFor(viewer, "teams.manage", "members.role").workspaceId));

export const createBranch = writableViewerActionClient
  .schema(z.object({ name: z.string().max(60) }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.createBranchFor(actorFor(viewer, "teams.manage"), parsedInput.name)));

export const renameBranch = writableViewerActionClient
  .schema(z.object({ branchId: id, name: z.string().max(60) }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.renameBranchFor(actorFor(viewer, "teams.manage"), parsedInput.branchId, parsedInput.name)));

export const deleteBranch = writableViewerActionClient
  .schema(z.object({ branchId: id }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.deleteBranchFor(actorFor(viewer, "teams.manage"), parsedInput.branchId)));

export const createTeam = writableViewerActionClient
  .schema(z.object({ name: z.string().max(60), branchId: id.nullable().optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.createTeamFor(actorFor(viewer, "teams.manage"), parsedInput)));

export const updateTeam = writableViewerActionClient
  .schema(z.object({ teamId: id, name: z.string().max(60).optional(), branchId: id.nullable().optional() }))
  .action(async ({ parsedInput: { teamId, ...input }, ctx: { viewer } }) => done(await r.updateTeamFor(actorFor(viewer, "teams.manage"), teamId, input)));

export const deleteTeam = writableViewerActionClient
  .schema(z.object({ teamId: id }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.deleteTeamFor(actorFor(viewer, "teams.manage"), parsedInput.teamId)));

export const setTeamMember = writableViewerActionClient
  .schema(z.object({ teamId: id, membershipId: id, member: z.boolean(), isLead: z.boolean().optional() }))
  .action(async ({ parsedInput: { teamId, ...input }, ctx: { viewer } }) => done(await r.setTeamMemberFor(actorFor(viewer, "teams.manage"), teamId, input)));

export const setCourseTeam = writableViewerActionClient
  .schema(z.object({ courseId: id, teamId: id.nullable() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => done(await r.setCourseTeamFor(actorFor(viewer, "teams.manage"), parsedInput.courseId, parsedInput.teamId)));
