import "server-only";

/**
 * One team for its settings page (viewer.md, "Roles and branches"): its
 * members, the staff who could join it, its courses and the courses that
 * could move into it. Writes go through A's role-actions.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { effectiveRole } from "@/lib/roles";
import { scopedCourseWhere, staffScope, type Viewer } from "@/lib/viewer-core";

export interface TeamPerson {
  membershipId: string;
  name: string;
  roleName: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  members: Array<TeamPerson & { isLead: boolean }>;
  /** Active staff who aren't on the team. */
  others: TeamPerson[];
  courses: Array<{ id: string; name: string }>;
  /** Courses the viewer may move into the team, with the team they're in now. */
  movable: Array<{ id: string; name: string; teamName: string | null }>;
}

/**
 * Courses the viewer may move: every course for a whole-organisation role;
 * for a branch role, those in their branches' teams and unassigned ones
 * they own or teach. An unassigned course that isn't theirs stays out.
 */
function movableWhere(viewer: Viewer): Prisma.CourseWhereInput {
  const scope = staffScope(viewer);
  if (scope === "WORKSPACE") return {};
  if (scope !== "BRANCHES" || !viewer.membership) return { id: "-" };
  const branchIds = viewer.membership.branchIds ?? [];
  return { AND: [scopedCourseWhere({ membershipId: viewer.membership.id, branchIds }), { OR: [{ teamId: null }, { team: { branchId: { in: branchIds } } }] }] };
}

export async function getTeamDetail(viewer: Viewer, teamId: string): Promise<TeamDetail | null> {
  if (!viewer.workspace) return null;
  const workspaceId = viewer.workspace.id;
  const team = await prisma.team.findFirst({
    where: { id: teamId, workspaceId },
    select: {
      id: true, name: true, branchId: true, branch: { select: { name: true } },
      members: { select: { membershipId: true, isLead: true } },
      courses: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!team) return null;

  const [staff, movable] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: {
        id: true, role: true, presetRole: true,
        customRole: { select: { id: true, name: true, permissions: true, scope: true } },
        user: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
      take: 500,
    }),
    prisma.course.findMany({
      // Spelt out: "not this team" alone drops rows with no team (NULL).
      where: { workspaceId, AND: [movableWhere(viewer), { OR: [{ teamId: null }, { teamId: { not: teamId } }] }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, team: { select: { name: true } } },
      take: 500,
    }),
  ]);
  const lead = new Map(team.members.map((m) => [m.membershipId, m.isLead]));
  const people = staff.map((m) => ({ membershipId: m.id, name: m.user.name, roleName: effectiveRole(m).name }));
  return {
    id: team.id,
    name: team.name,
    branchId: team.branchId,
    branchName: team.branch?.name ?? null,
    members: people.filter((p) => lead.has(p.membershipId)).map((p) => ({ ...p, isLead: lead.get(p.membershipId)! })),
    others: people.filter((p) => !lead.has(p.membershipId)),
    courses: team.courses,
    movable: movable.map((c) => ({ id: c.id, name: c.name, teamName: c.team?.name ?? null })),
  };
}
