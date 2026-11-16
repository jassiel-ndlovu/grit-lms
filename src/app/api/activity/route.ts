import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { gone } from "@/lib/api-guard";
import { prisma } from "@/lib/db";

/**
 * Returns the caller's own activity only. The `userId` and `courseIds`
 * query parameters the legacy context still sends are ignored: they used to
 * select whose rows came back, so any signed-in user could read anyone's
 * activity log (with their email address). No screen shows course-wide
 * activity today, so nothing else is returned.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activities = await prisma.activityLog.findMany({
      where: { userId: token.id as string },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Retired — nothing calls `logActivity` any more, and this handler let any
 * signed-in user write log rows for any userId. Server code writes
 * ActivityLog rows directly.
 */
export function POST() {
  return gone("Activity rows are written server-side.");
}
