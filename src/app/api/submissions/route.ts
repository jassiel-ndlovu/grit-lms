import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courseIds = searchParams.get("courseIds");
  const courseId = searchParams.get("courseId");
  const tutorId = searchParams.get("tutorId");
  const studentId = searchParams.get("studentId");
  const subId = searchParams.get("id");

  if (courseId && studentId) {
    const submissions = await prisma.submission.findMany({
      where: {
        course: {
          id: courseId,
          students: {
            some: {
              id: studentId,
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(submissions);
  } else if (courseIds) {
    const ids = courseIds.split(",");

    const submissions = await prisma.submission.findMany({
      where: {
        courseId: {
          in: ids,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(submissions);
  } else if (studentId) {
    const submissions = await prisma.submission.findMany({
      where: {
        course: {
          students: {
            some: {
              id: studentId,
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(submissions);
  } else if (tutorId) {
    const submissions = await prisma.submission.findMany({
      where: {
        course: {
          tutorId: tutorId,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(submissions);
  } else if (subId) {
    const submission = await prisma.submission.findUnique({
      where: {
        id: subId,
      },
    });

    return NextResponse.json(submission);
  }

  return NextResponse.json({ error: "Submission not found" }, { status: 404 });
}

// POST /api/submissions
export async function POST(req: Request) {
  const body = await req.json();

  const submission = await prisma.submission.create({
    data: {
      title: body.title,
      fileType: body.fileType,
      description: body.description,
      descriptionFiles: body.descriptionFiles,
      lastDueDate: body.lastDueDate ? new Date(body.lastDueDate) : null,
      courseId: body.courseId,
      maxAttempts: body.maxAttempts,
      totalPoints: body.totalPoints,
      isActive: body.isActive,
      dueDate: new Date(body.dueDate),
      createdAt: new Date(Date.now()),
    },
  });

  await prisma.notification.create({
    data: {
      title: "New Submission",
      message: `Assignment "${submission.title}" has been created.`,
      link: `/dashboard/submissions/${submission.id}`,
      type: "SUBMISSION_CREATED",
      courseId: submission.courseId,
    },
  });

  return NextResponse.json(submission);
}
