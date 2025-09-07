/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");
    const testId = searchParams.get("testId");
    const studentId = searchParams.get("studentId");
    const questionId = searchParams.get("questionId");

    const whereClause: any = {};

    if (submissionId) {
      whereClause.OR = [
        { testSubmissionId: submissionId },
        { submissionEntryId: submissionId }
      ];
    }

    if (testId) {
      // For test submissions, we need to join with TestSubmission to filter by testId
      const questionGrades = await prisma.questionGrade.findMany({
        where: {
          testSubmission: {
            testId: testId
          }
        },
        include: {
          testSubmission: true
        }
      });
      return NextResponse.json(questionGrades);
    }

    if (studentId && submissionId) {
      whereClause.OR = [
        {
          testSubmission: {
            studentId: studentId,
            id: submissionId
          }
        },
        {
          submissionEntry: {
            studentId: studentId,
            id: submissionId
          }
        }
      ];
    }

    if (studentId && testId) {
      const questionGrades = await prisma.questionGrade.findMany({
        where: {
          testSubmission: {
            studentId: studentId,
            testId: testId
          }
        },
        include: {
          testSubmission: true
        }
      });
      return NextResponse.json(questionGrades);
    }

    if (questionId) {
      whereClause.questionId = questionId;
    }

    const questionGrades = await prisma.questionGrade.findMany({
      where: whereClause,
      include: {
        testSubmission: true,
        submissionEntry: true
      }
    });

    return NextResponse.json(questionGrades);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (data.score === undefined || data.outOf === undefined) {
      return NextResponse.json(
        { error: "Score and outOf are required fields" },
        { status: 400 }
      );
    }

    // Ensure at least one submission reference exists
    if (!data.testSubmissionId && !data.submissionEntryId) {
      return NextResponse.json(
        { error: "Either testSubmissionId or submissionEntryId is required" },
        { status: 400 }
      );
    }

    const questionGrade = await prisma.questionGrade.create({
      data: {
        questionId: data.questionId,
        score: data.score,
        outOf: data.outOf,
        feedback: data.feedback,
        testSubmissionId: data.testSubmissionId,
        submissionEntryId: data.submissionEntryId
      },
      include: {
        testSubmission: true,
        submissionEntry: true
      }
    });

    return NextResponse.json(questionGrade);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}