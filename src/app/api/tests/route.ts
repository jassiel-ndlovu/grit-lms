import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const tutorId = req.nextUrl.searchParams.get("tutorId");
  const testId = req.nextUrl.searchParams.get("testId");
  const courseIds = req.nextUrl.searchParams.get("courseIds");

  if (!tutorId && !testId && !courseIds)
    return NextResponse.json(
      { error: "Course, Test or Tutor ID required" },
      { status: 400 }
    );

  if (tutorId) {
    const tests = await prisma.test.findMany({
      where: {
        course: {
          tutorId: tutorId,
        },
      },
      include: {
        course: true,
        submissions: true,
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
        course: true,
        submissions: true,
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
          course: true,
          submissions: true,
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
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  
  const newTest = await prisma.test.create({
    data: {
      ...data,
      questions: {
        // @ts-ignore
        create: data.questions.map((q: any) => ({
          question: q.question,
          type: q.type,
          points: q.points,
          options: q.options,
          answer: q.answer
        }))
      }
    },
    include: {
      questions: true
    }
  });

  return NextResponse.json(newTest);
}
