/** GET /api/calendar/events/[id]/ics: one event (with its series) as a download, for someone allowed to see it. */

import { NextResponse } from "next/server";

import { eventIcsFor } from "@/features/calendar/calendar";
import { prisma } from "@/lib/db";
import { canIn, getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const e = await prisma.courseEvent.findUnique({ where: { id }, select: { courseId: true } });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const userIds = [viewer.user.id, ...viewer.children.map((c) => c.userId)];
  const allowed =
    (await canIn(viewer, "content.view", { courseId: e.courseId })) ||
    (await prisma.enrollment.count({ where: { courseId: e.courseId, endedAt: null, learner: { userId: { in: userIds } } } })) > 0;
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const out = await eventIcsFor(id);
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const name = out.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "event";
  return new NextResponse(out.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
