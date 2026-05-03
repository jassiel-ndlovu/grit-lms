/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

// GET: fetch entries (optionally filtered by submissionId or studentId)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const submissionId = searchParams.get("submissionId");
  const studentId = searchParams.get("studentId");

  const where: any = {};
  const include: any = {
    student: true,
    grade: true,
    questionGrades: true,
  };

  if (submissionId && studentId) {
    const entry = await prisma.submissionEntry.findUnique({
      where: {
        submissionId_studentId: {
          submissionId,
          studentId,
        },
      },
      include,
    });

    return NextResponse.json(entry);
  } else if (submissionId) where.submissionId = submissionId;
  else if (studentId) where.studentId = studentId;

  const entries = await prisma.submissionEntry.findMany({ where, include });

  return NextResponse.json(entries);
}

// POST: create a new entry
export async function POST(req: NextRequest) {
  const token = await getToken({ req });

  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.id;

  try {
    const data = await req.json();
    const entry = await prisma.submissionEntry.create({ data });

    // activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: "ASSIGNMENT_SUBMITTED",
        targetId: data.submissionId,
        meta: { attemptNumber: data.attemptNumber },
      },
    });

    // notification
    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId },
    });

    if (submission) {
      await prisma.notification.create({
        data: {
          title: "Assignment Submitted",
          message: `Your submission for "${submission.title}" has been received.`,
          link: `/dashboard//submissions/${submission.id}`,
          type: "SUBMISSION_DUE",
          studentId: data.studentId,
          courseId: submission.courseId,
        },
      });
    }

    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
