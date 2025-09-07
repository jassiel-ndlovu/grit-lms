/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId");
  const testId = req.nextUrl.searchParams.get("testId");
  const submissionIds = req.nextUrl.searchParams.get("submissionIds");

  const include: any = {
    student: true,
    uploadedFiles: true,
    grade: true,
    questionGrades: true,
  };

  // Fetch specific submission by testId and studentId
  if (testId && studentId) {
    try {
      const submission = await prisma.testSubmission.findFirst({
        where: { testId, studentId },
        include,
      });

      if (!submission) {
        return NextResponse.json(
          { error: "Submission not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(submission);
    } catch (error) {
      console.error("Error fetching submission:", error);
      return NextResponse.json(
        { error: "Failed to fetch submission" },
        { status: 500 }
      );
    }
  } else if (!testId && !submissionIds && !studentId) {
    // Return all submissions if no filters are provided
    try {
      const submissions = await prisma.testSubmission.findMany({
        include,
        orderBy: { submittedAt: "desc" },
      });
      return NextResponse.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 }
      );
    }
  }

  if (testId) {
    try {
      const submissions = await prisma.testSubmission.findMany({
        where: { testId },
        include,
        orderBy: { submittedAt: "desc" },
      });
      return NextResponse.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions by test ID:", error);
      return NextResponse.json(
        { error: "Failed to fetch submissions by test ID" },
        { status: 500 }
      );
    }
  } else if (submissionIds) {
    const ids = submissionIds.split(",").filter(Boolean);
    try {
      const submissions = await prisma.testSubmission.findMany({
        where: { id: { in: ids } },
        include,
      });
      return NextResponse.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions by IDs:", error);
      return NextResponse.json(
        { error: "Failed to fetch submissions by IDs" },
        { status: 500 }
      );
    }
  } else if (studentId) {
    try {
      const submissions = await prisma.testSubmission.findMany({
        where: { studentId },
        include,
        orderBy: { submittedAt: "desc" },
      });
      return NextResponse.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions by student ID:", error);
      return NextResponse.json(
        { error: "Failed to fetch submissions by student ID" },
        { status: 500 }
      );
    }
  }
}

// POST create new submission
export async function POST(req: NextRequest) {
  const token = await getToken({ req });

  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.id;

  try {
    const data = await req.json();

    const submission = await prisma.testSubmission.create({
      data: {
        testId: data.testId,
        studentId: data.studentId,
        startedAt: new Date(data.startedAt),
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : null,
        answers: data.answers,
        score: data.score ?? null,
        feedback: data.feedback ?? null,
        status: data.status,
        uploadedFiles: data.uploadedFiles
          ? {
              create: data.uploadedFiles.map((file: any) => ({
                fileUrl: file.fileUrl,
                fileType: file.fileType,
                questionId: file.questionId,
              })),
            }
          : undefined,
      },
      include: {
        test: true,
        student: true,
        uploadedFiles: true,
      },
    });

    // activity logs
    await prisma.activityLog.create({
      data: {
        userId,
        action: "TEST_COMPLETED",
        targetId: data.testId,
        meta: { score: data.score ?? 0 },
      },
    });

    // notifications
    const test = await prisma.test.findUnique({
      where: { id: data.testId },
    });

    if (test) {
    await prisma.notification.create({
      data: {
        title: "Test Submitted",
        message: `Your test "${test.title}" has been submitted.`,
        link: `/dashboard/tests/review/${test.id}`,
        type: "TEST_DUE",
        studentId: data.studentId,
        courseId: test.courseId,
      },
    });
  }

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}
