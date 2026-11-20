/**
 * GET /api/account/export: a POPIA data export as a JSON download (design
 * 02, section 8). Without `userId`, the viewer's own data. With `userId`, a
 * tutor exports a student they teach (or that student's parent), to pass on
 * to the parent. Once per 24 hours per person exported.
 */

import { NextResponse } from "next/server";

import { exportUserData, recentExport } from "@/features/users/export";
import { prisma } from "@/lib/db";
import { canIn, getViewer } from "@/lib/viewer";
import { can, needsScope } from "@/lib/viewer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const target = new URL(req.url).searchParams.get("userId") ?? viewer.user.id;

  if (target !== viewer.user.id) {
    const ws = viewer.workspace?.id;
    if (!ws || !can(viewer, "learners.invite")) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const t = await prisma.user.findUnique({
      where: { id: target },
      select: { memberships: { where: { status: "ACTIVE" }, select: { id: true } }, learners: { where: { workspaceId: ws }, select: { enrollments: { where: { endedAt: null }, select: { courseId: true } } } } },
    });
    if (!t || t.memberships.length || t.learners.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (needsScope(viewer, "learners.invite")) {
      let ok = false;
      for (const e of t.learners.flatMap((l) => l.enrollments)) if (await canIn(viewer, "learners.invite", { courseId: e.courseId })) { ok = true; break; }
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const last = await recentExport(target);
  if (last) return NextResponse.json({ error: "An export was made in the last 24 hours. Try again later.", lastAt: last.at }, { status: 429 });
  const data = await exportUserData(target, { userId: viewer.user.id, workspaceId: viewer.workspace?.id ?? null });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexa-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
