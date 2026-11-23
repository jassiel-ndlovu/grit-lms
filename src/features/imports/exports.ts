/**
 * Exports (#216, phase 1). The students export uses the import template's
 * columns, so a file can go out, be edited and come back in: students who
 * already belong to the workspace are updated, not duplicated. Server only.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { scopedCourseWhere } from "@/lib/viewer-core";

import { toCsv } from "./csv";
import { studentsImporter } from "./importers/students";

/** The workspace's active students (for a tutor: those on their courses), with their first parent. */
export async function studentsCsvFor(workspaceId: string, scope: { membershipId: string; branchIds?: string[] } | null): Promise<{ csv: string; rows: number }> {
  const courseScope = scope ? scopedCourseWhere(scope) : {};
  const learners = await prisma.learner.findMany({
    where: { workspaceId, status: "ACTIVE", ...(scope ? { enrollments: { some: { endedAt: null, course: courseScope } } } : {}) },
    orderBy: { user: { name: "asc" } },
    select: {
      isMinor: true,
      user: {
        select: {
          name: true, email: true, emailIsPlaceholder: true, username: true,
          guardedBy: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1, select: { relationship: true, guardian: { select: { name: true, email: true, emailIsPlaceholder: true } } } },
        },
      },
      enrollments: { where: { endedAt: null, course: courseScope }, select: { course: { select: { name: true } } } },
    },
  });
  const rows = learners.map((l) => {
    const g = l.user.guardedBy[0];
    return [
      l.user.name,
      l.user.emailIsPlaceholder ? "" : l.user.email,
      l.user.username ?? "",
      l.isMinor ? "yes" : "no",
      l.enrollments.map((e) => e.course.name).join("; "),
      g?.guardian.name ?? "",
      g && !g.guardian.emailIsPlaceholder ? g.guardian.email : "",
      g ? g.relationship.toLowerCase() : "",
    ];
  });
  return { csv: toCsv(studentsImporter.template.headers, rows), rows: rows.length };
}
