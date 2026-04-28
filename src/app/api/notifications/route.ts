/**
 * /api/notifications — legacy route, partially retired.
 *
 * GET is preserved temporarily because the legacy `NotificationsContext`
 * still hits it on a couple of unmigrated pages (calendar, course
 * overview). The two writer pages (header bell and the full notifications
 * page) have moved to typed Server Actions in
 * `src/features/notifications/actions.ts`, so the PUT (mark all read)
 * handler is retired below.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once
 * `NotificationsContext` is deleted (or migrated to RSC queries) along
 * with its remaining consumers.
 */

import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const courseIds = searchParams.getAll("courseIds");

    if (!studentId && courseIds.length === 0) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    let whereClause = {};

    if (studentId && courseIds.length > 0) {
      // Fetch both user-specific and course-specific notifications
      whereClause = {
        OR: [{ studentId: studentId }, { courseId: { in: courseIds } }],
      };
    } else if (studentId) {
      // Fetch only user-specific notifications
      whereClause = { studentId: studentId };
    } else if (courseIds.length > 0) {
      // Fetch only course-specific notifications
      whereClause = { courseId: { in: courseIds } };
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      include: {
        course: {
          select: {
            name: true,
            imageUrl: true,
          },
        },
        student: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Retired — use `markAllNotificationsRead` Server Action.
 * @see src/features/notifications/actions.ts
 */
export function PUT() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the markAllNotificationsRead Server Action (src/features/notifications/actions.ts).",
    },
    { status: 410 },
  );
}
