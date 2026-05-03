/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tutorId = searchParams.get("tutorId");
  const studentId = searchParams.get("studentId");
  const testId = searchParams.get("testId");
  const courseIds = searchParams.get("courseIds");
  const courseId = searchParams.get("courseId");
  const isActiveParam = searchParams.get("isActive");

  // Parse isActive parameter (if provided)
  let isActive: boolean | undefined = undefined;
  if (isActiveParam !== null) {
    isActive = isActiveParam.toLowerCase() === "true";
  }

  if (!tutorId && !testId && !courseIds && !studentId && !courseId) {
    return NextResponse.json(
      { error: "Course, Test or Tutor ID required" },
      { status: 400 }
    );
  }

  // Base where clause with isActive filtering
  const baseWhere: any = {};
  if (isActive !== undefined) {
    baseWhere.isActive = isActive;
  }

  if (courseId && studentId) {
    const tests = await prisma.test.findMany({
      where: {
        ...baseWhere,
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
        ...baseWhere,
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
        ...(isActive !== undefined && { isActive }), // Only apply isActive filter for single test if specified
      },
      include: {
        questions: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    return NextResponse.json(test);
  } else if (courseIds) {
    const courseIdsArray = courseIds.split(",").filter(Boolean);

    try {
      const tests = await prisma.test.findMany({
        where: {
          ...baseWhere,
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
        ...baseWhere,
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

  // Fallback response
  return NextResponse.json(
    { error: "Invalid request parameters" },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const result = await prisma.$transaction(async (tx) => {
      // Create test
      const newTest = await tx.test.create({
        data: {
          title: data.title,
          description: data.description,
          preTestInstructions: data.preTestInstructions,
          courseId: data.courseId,
          dueDate: new Date(data.dueDate),
          timeLimit: data.timeLimit,
          totalPoints: data.totalPoints,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      // Create new questions using the same non-recursive queue approach as PUT
      if (data.questions && data.questions.length > 0) {
        await createQuestions(data.questions, newTest.id, tx);
        console.log("Questions created successfully for new test");
      }

      // Fetch the complete test with questions and subquestions
      const completeTest = await tx.test.findUnique({
        where: { id: newTest.id },
        include: {
          questions: {
            include: {
              subQuestions: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      // Create notification if test is active
      if (data.isActive === true) {
        await tx.notification.create({
          data: {
            title: "New Test Created",
            message: `A new test "${newTest.title}" has been published.`,
            link: `/dashboard/tests/${newTest.id}`,
            type: "TEST_CREATED",
            courseId: newTest.courseId,
          },
        });
      }

      return completeTest;
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create test:", error);
    return NextResponse.json(
      { error: "Failed to create test: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

async function createQuestions(
  questions: any[],
  testId: string,
  tx: any
) {
  const queue: { question: any; parentId: string | null }[] = [];
  
  // First, add all root questions to the queue
  questions.forEach((question, index) => {
    queue.push({ question: { ...question, order: index }, parentId: null });
  });

  console.log("Root questions to process:", queue.length);

  const createdQuestions = new Map(); // Store created questions for reference

  while (queue.length > 0) {
    const { question, parentId } = queue.shift()!;

    if (question.subQuestions) {
      console.log(`Processing question with ${question.subQuestions.length} subQuestions`);
    } else {
      console.log("Sub-question with parentId:", parentId);
    }

    const createdQuestion = await tx.testQuestion.create({
      data: {
        testId: testId,
        question: question.question || "",
        type: question.type,
        points: question.points || 0,
        options: question.options || [],
        answer: question.answer,
        language: question.language,
        matchPairs: question.matchPairs,
        reorderItems: question.reorderItems || [],
        blankCount: question.blankCount,
        order: question.order,
        parentId: parentId,
      },
    });

    createdQuestions.set(question.tempId || createdQuestion.id, createdQuestion);

    // Add subquestions to the queue
    if (question.subQuestions && question.subQuestions.length > 0) {
      question.subQuestions.forEach((subQuestion: any, subIndex: number) => {
        queue.push({
          question: { ...subQuestion, order: subIndex },
          parentId: createdQuestion.id
        });
      });
    }
  }
}