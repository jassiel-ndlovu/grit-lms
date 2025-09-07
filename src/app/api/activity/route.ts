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

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, action, targetId, meta } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "User ID and action are required" },
        { status: 400 }
      );
    }

    const activity = await prisma.activityLog.create({
      data: {
        userId: userId,
        action,
        targetId,
        meta: meta || {},
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}