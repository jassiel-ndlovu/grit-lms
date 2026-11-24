/**
 * Which staff a manager may act on (#216 phase 3): the whole workspace,
 * members of teams in their branches, or only themselves. Server only.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can, staffScope, type Permission } from "@/lib/viewer-core";

/** Membership ids the viewer manages for `permission`, or "ALL" for the whole workspace. Always includes their own. */
export async function managedMemberships(viewer: Viewer, permission: Permission): Promise<"ALL" | string[]> {
  if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
  const own = viewer.membership?.id ? [viewer.membership.id] : [];
  if (!can(viewer, permission)) return own;
  if (viewer.persona === "admin") return "ALL";
  const scope = staffScope(viewer);
  if (scope === "WORKSPACE") return "ALL";
  if (scope === "BRANCHES") {
    const branchIds = viewer.membership?.branchIds ?? [];
    if (!branchIds.length) return own;
    const rows = await prisma.membership.findMany({
      where: { workspaceId: viewer.workspace.id, teams: { some: { team: { branchId: { in: branchIds } } } } },
      select: { id: true },
    });
    return [...new Set([...own, ...rows.map((r) => r.id)])];
  }
  return own;
}

/** Throws unless the viewer may act on `membershipId` (their own, or managed with `permission`). */
export async function assertManages(viewer: Viewer, membershipId: string, permission: Permission): Promise<"self" | "manager"> {
  if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
  const m = await prisma.membership.findUnique({ where: { id: membershipId }, select: { workspaceId: true } });
  if (!m || m.workspaceId !== viewer.workspace.id) throw new ViewerError("FORBIDDEN");
  if (membershipId === viewer.membership?.id) return can(viewer, permission) ? "manager" : "self";
  const scope = await managedMemberships(viewer, permission);
  if (scope !== "ALL" && !scope.includes(membershipId)) throw new ViewerError("FORBIDDEN");
  return "manager";
}
