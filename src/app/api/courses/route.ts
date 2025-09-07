import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const tutorId = req.nextUrl.searchParams.get("tutorId");
  const studentId = req.nextUrl.searchParams.get("studentId");
  const courseIds = req.nextUrl.searchParams.get("ids");

  if (!tutorId && !studentId && !courseIds) {
    const courses = await prisma.course.findMany({
      include: {
        tutor: true,
        students: true,
        lessons: {
          include: {
            attachmentUrls: true,
          },
        },
        quizzes: true,
        tests: true,
        submissions: true,
        courseEvents: true,
      },
    });

    return NextResponse.json(courses);
  }

  if (tutorId) {
    const courses = await prisma.course.findMany({
      where: { tutorId },
      include: {
        tutor: true,
        students: true,
        lessons: {
          include: {
            attachmentUrls: true,
          },
        },
        quizzes: true,
        tests: true,
        submissions: true,
        courseEvents: true,
      },
    });
    return NextResponse.json(courses);
  } else if (studentId) {
    const courses = await prisma.course.findMany({
      where: { students: { some: { id: studentId } } },
      include: {
        tutor: true,
        students: true,
        lessons: {
          include: {
            attachmentUrls: true,
          },
        },
        quizzes: true,
        tests: true,
        courseEvents: true,
      },
    });

    return NextResponse.json(courses);
  } else if (courseIds) {
    const courseIdsArray = courseIds.split(",");

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIdsArray } },
      include: {
        tutor: true,
        students: true,
        lessons: {
          include: {
            attachmentUrls: true,
          },
        },
        quizzes: true,
        tests: true,
        submissions: true,
        courseEvents: true,
      },
    });

    return NextResponse.json(courses);
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || token.role !== "TUTOR") {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const data = await req.json();

  const created = await prisma.course.create({
    data: {
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      createdAt: new Date(),
      tutor: {
        connect: { email: token.email },
      },
      students: {
        connect:
          data.students?.map((s: AppTypes.Student) => ({ id: s.id })) || [],
      },
    },
    include: {
      tutor: true,
      students: true,
      lessons: true,
      quizzes: true,
      tests: true,
      submissions: true,
      courseEvents: true,
    },
  });

  await prisma.notification.create({
    data: {
      title: "New Course Available",
      message: `A new course "${created.name}" is available.`,
      link: `/dashboard/courses/${created.id}`,
      type: "COURSE_UPDATE",
      courseId: created.id,
    },
  });

  return NextResponse.json(created);
}
