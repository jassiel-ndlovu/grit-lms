/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;

  try {
    const submission = await prisma.testSubmission.findUnique({
      where: { id: id },
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
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  try {
    const data = await req.json();

    const updated = await prisma.testSubmission.update({
      where: { id: id },
      data: {
        score: data.score ?? undefined,
        feedback: data.feedback ?? undefined,
        status: data.status ?? undefined,
        answers: data.answers ?? undefined,
        uploadedFiles: data.uploadedFiles
          ? {
              deleteMany: {}, // remove old files before re-adding
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating submission:", error);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  try {
    await prisma.testSubmission.delete({
      where: { id: id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting submission:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
