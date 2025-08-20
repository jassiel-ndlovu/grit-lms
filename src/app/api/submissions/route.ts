import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/submissions?courseId=123
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  const submissions = await prisma.submission.findMany({
    where: courseId ? { courseId } : {},
    include: { entries: true },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(submissions);
}

// POST /api/submissions
export async function POST(req: Request) {
  const body = await req.json();

  const submission = await prisma.submission.create({
    data: {
      title: body.title,
      fileType: body.fileType,
      courseId: body.courseId,
      maxAttempts: body.maxAttempts,
      dueDate: new Date(body.dueDate),
      createdAt: new Date(Date.now()),
    },
  });

  return NextResponse.json(submission);
}
