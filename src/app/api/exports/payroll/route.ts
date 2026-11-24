/**
 * GET /api/exports/payroll?month=YYYY-MM[&detail=1]: approved timesheets as
 * CSV (#216 phase 3). Staff with timesheets.manage, for the staff in their
 * scope. Audited.
 */

import { NextResponse } from "next/server";

import { payrollCsv } from "@/features/staff/timesheets";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { getViewer, ViewerError } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  try {
    const out = await payrollCsv(viewer, { month: params.get("month") ?? "", detail: params.get("detail") === "1" });
    await prisma.auditLog.create({ data: { workspaceId: viewer.workspace!.id, actorUserId: viewer.user.id, action: "export.payroll", targetType: "Workspace", targetId: viewer.workspace!.id, data: { month: params.get("month"), detail: params.get("detail") === "1" } } });
    return new NextResponse(out.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${out.fileName}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ViewerError) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
