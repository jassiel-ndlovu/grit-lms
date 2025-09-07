/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const lessonId = searchParams.get("lessonId");

    let completions;
    if (studentId && lessonId) {
      completions = await prisma.lessonCompletion.findFirst({
        where: { studentId, lessonId },
        include: { student: true, lesson: true },
      });
    } else if (studentId) {
      completions = await prisma.lessonCompletion.findMany({
        where: { studentId },
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    } else if (lessonId) {
      completions = await prisma.lessonCompletion.findMany({
        where: { lessonId },
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    } else {
      completions = await prisma.lessonCompletion.findMany({
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    }

    return NextResponse.json(completions);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to fetch lesson completions", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, lessonId, completedAt } = body;
    const token = await getToken({ req });

    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = token.id;

    if (!studentId || !lessonId) {
      return NextResponse.json(
        { message: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const completion = await prisma.lessonCompletion.create({
      data: {
        studentId,
        lessonId,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      },
    });

    // activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: "LESSON_COMPLETED",
        targetId: lessonId,
      },
    });

    return NextResponse.json(completion, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to create lesson completion", error: err.message },
      { status: 500 }
    );
  }
}
