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
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    let whereClause = {};

    if (studentId && courseIds.length > 0) {
      // Fetch both user-specific and course-specific notifications
      whereClause = {
        OR: [
          { studentId: studentId },
          { courseId: { in: courseIds } }
        ]
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
            imageUrl: true
          }
        },
        student: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken({ req });
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get user's courses to also mark course notifications as read
    const userCourses = await prisma.course.findMany({
      where: {
        students: {
          some: {
            id: studentId
          }
        }
      },
      select: {
        id: true
      }
    });

    const courseIds = userCourses.map(course => course.id);

    await prisma.notification.updateMany({
      where: {
        OR: [
          { studentId: studentId },
          { courseId: { in: courseIds } }
        ],
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}