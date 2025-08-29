/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId");
  const testId = req.nextUrl.searchParams.get("testId");
  const submissionIds = req.nextUrl.searchParams.get("submissionIds");

  // Fetch specific submission by testId and studentId
  if (testId && studentId) {
    try {
      const submission = await prisma.testSubmission.findFirst({
        where: { testId, studentId },
        include: {
          test: true,
          student: true,
          uploadedFiles: true,
        },
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
        include: {
          test: true,
          student: true,
          uploadedFiles: true,
        },
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
        include: {
          test: true,
          student: true,
          uploadedFiles: true,
        },
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
        include: {
          test: true,
          student: true,
          uploadedFiles: true,
        },
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
        include: {
          test: true,
          student: true,
          uploadedFiles: true,
        },
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
export async function POST(req: Request) {
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

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}
