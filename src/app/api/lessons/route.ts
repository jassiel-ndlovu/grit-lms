import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });

  const lessons = await prisma.lesson.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(lessons);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, videoUrl, attachmentUrls, courseId, order } = body;

  if (!title || !courseId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const newLesson = await prisma.lesson.create({
    data: {
      title,
      description,
      videoUrl,
      attachmentUrls: {
        create: attachmentUrls
      }, 
      courseId,
      order: order ?? 0,
    },
  });

  return NextResponse.json(newLesson);
}
