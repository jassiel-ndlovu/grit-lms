/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await req.json();
    const { id } = await params;

    const result = await prisma.$transaction(
      async (tx) => {
        // DELETE ALL QUESTIONS - SIMPLE AND DIRECT
        await tx.testQuestion.deleteMany({
          where: { testId: id },
        });

        // Update test
        const updatedTest = await tx.test.update({
          where: { id: id },
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

        // Create new questions using simple non-recursive approach
        if (data.questions && data.questions.length > 0) {
          await createQuestions(data.questions, id, tx);
        }

        // Fetch complete test
        const completeTest = await tx.test.findUnique({
          where: { id: id },
          include: {
            questions: {
              include: { subQuestions: true },
              orderBy: { order: "asc" },
            },
          },
        });

        // Notification
        if (data.isActive === true) {
          await tx.notification.create({
            data: {
              title: "Test Updated",
              message: `The test "${updatedTest.title}" has been updated.`,
              link: `/dashboard/tests/${updatedTest.id}`,
              type: "TEST_UPDATED",
              courseId: updatedTest.courseId,
            },
          });
        }

        return completeTest;
      },
      { timeout: 30000 }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update test:", error);
    return NextResponse.json(
      {
        error:
          "Failed to update test: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}

// Non-recursive approach using a queue
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

  const createdQuestions = new Map(); // Store created questions for reference

  while (queue.length > 0) {
    const { question, parentId } = queue.shift()!;

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

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const test = await prisma.test.delete({
      where: { id: id },
      // Cascade delete will automatically handle questions and subquestions
    });

    await prisma.notification.create({
      data: {
        title: "Test Deleted",
        message: `The test "${test.title}" has been removed.`,
        type: "TEST_DELETED",
        courseId: test.courseId,
      },
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete test:", error);
    return NextResponse.json(
      {
        error:
          "Failed to delete test: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
