import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { gone } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const courseIds = searchParams.getAll("courseIds");

    if (!userId && courseIds.length === 0) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    let whereClause = {};

    if (userId && courseIds.length > 0) {
      // For JSON field filtering, we need to use raw SQL or multiple OR conditions
      // Since Prisma doesn't support `in` for JSON fields, we'll create multiple OR conditions
      const courseIdConditions = courseIds.map(courseId => ({
        meta: {
          path: ['courseId'],
          equals: courseId
        }
      }));

      whereClause = {
        OR: [
          { userId: userId },
          ...courseIdConditions
        ],
      };
    } else if (userId) {
      // Fetch only user-specific activities
      whereClause = { userId: userId };
    } else if (courseIds.length > 0) {
      // For course-related activities, create multiple OR conditions
      const courseIdConditions = courseIds.map(courseId => ({
        meta: {
          path: ['courseId'],
          equals: courseId
        }
      }));

      whereClause = {
        OR: courseIdConditions
      };
    }

    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
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
