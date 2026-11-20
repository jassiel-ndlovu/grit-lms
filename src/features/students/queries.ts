/**
 * Student queries — server-only data access for the students feature.
 */

import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * The students in one workspace (active learners there), ordered by name,
 * for the course form's enrol picker. Never every student on the platform:
 * that showed other workspaces' students and emails to any tutor (owner's
 * decision 2026-11-20: workspace only, everywhere; new students are added
 * from the Students page). Null workspace: nobody.
 */
export const listWorkspaceStudents = cache(async (workspaceId: string | null) => {
  if (!workspaceId) return [];
  return prisma.student.findMany({
    where: { user: { learners: { some: { workspaceId, status: "ACTIVE" } } } },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      imageUrl: true,
    },
  });
});

export type StudentListItem = Awaited<ReturnType<typeof listWorkspaceStudents>>[number];
