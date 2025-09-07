import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tutorId = searchParams.get("tutorId");
  const studentId = searchParams.get("studentId");
  const testId = searchParams.get("testId");
  const courseIds = searchParams.get("courseIds");
  const courseId = searchParams.get("courseId");

  if (!tutorId && !testId && !courseIds && !studentId && !courseId) {
    return NextResponse.json(
      { error: "Course, Test or Tutor ID required" },
      { status: 400 }
    );
  }

  if (courseId && studentId) {
    const tests = await prisma.test.findMany({
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
      include: {
        questions: true,
      },
    });
    return NextResponse.json(tests);
  } else if (tutorId) {
    const tests = await prisma.test.findMany({
      where: {
        course: {
          tutorId: tutorId,
        },
      },
      include: {
        questions: true,
      },
    });
    return NextResponse.json(tests);
  } else if (testId) {
    const test = await prisma.test.findUnique({
      where: {
        id: testId,
      },
      include: {
        questions: true,
      },
    });
    return NextResponse.json(test);
  } else if (courseIds) {
    const courseIdsArray = courseIds.split(",").filter(Boolean);

    try {
      const tests = await prisma.test.findMany({
        where: {
          courseId: {
            in: courseIdsArray,
          },
        },
        include: {
          questions: true,
        },
      });

      return NextResponse.json(tests);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to fetch tests" + error },
        { status: 500 }
      );
    }
  } else if (studentId) {
    const tests = await prisma.test.findMany({
      where: {
        course: {
          students: {
            some: {
              id: studentId,
            },
          },
        },
      },
      include: {
        questions: true,
      },
    });
    return NextResponse.json(tests);
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();

  const newTest = await prisma.test.create({
    data: {
      ...data,
      questions: {
        create: data.questions.map((q: AppTypes.TestQuestion) => ({
          question: q.question,
          type: q.type,
          points: q.points,
          options: q.options,
          answer: q.answer,
        })),
      },
    },
    include: {
      questions: true,
    },
  });

  await prisma.notification.create({
  data: {
    title: "New Test Created",
    message: `A new test "${newTest.title}" has been published.`,
    link: `/dashboard/tests/${newTest.id}`,
    type: "TEST_CREATED",
    courseId: newTest.courseId,
  },
});

  return NextResponse.json(newTest);
}
