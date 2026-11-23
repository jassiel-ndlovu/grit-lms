/**
 * GET /api/exports/students: the workspace's students as CSV, in the
 * students import template's columns (#216). Staff with learners.invite;
 * a tutor gets the students on their own courses. Audited.
 */

import { NextResponse } from "next/server";

import { studentsCsvFor } from "@/features/imports/exports";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { can, courseScopeOf, needsScope } from "@/lib/viewer-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!viewer.workspace || !can(viewer, "learners.invite")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const scoped = needsScope(viewer, "learners.invite");
  if (scoped && !viewer.membership) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { csv, rows } = await studentsCsvFor(viewer.workspace.id, courseScopeOf(viewer, "learners.invite"));
  await prisma.auditLog.create({ data: { workspaceId: viewer.workspace.id, actorUserId: viewer.user.id, action: "export.students", targetType: "Workspace", targetId: viewer.workspace.id, data: { rows } } });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${viewer.workspace.slug}-students-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
