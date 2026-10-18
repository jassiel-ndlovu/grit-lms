/**
 * /api/submission-entry — legacy route for the client pages under
 * /dashboard/submissions (portal, review, overview).
 *
 * GET only returns entries the caller can see: a student's own entries, or
 * entries on assignments in a tutor's own courses. POST mirrors
 * `submitEntry` in `src/features/submissions/actions.ts`: student only, for
 * themselves, on an open assignment in a course they're enrolled in.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { Role } from "@/features/shared/enums";
import {
  forbidden,
  requireApiRole,
  requireApiSession,
  studentForSession,
} from "@/lib/api-guard";

function visibleEntriesWhere(session: Session): Prisma.SubmissionEntryWhereInput | null {
  const email = session.user.email;
  switch (session.user.role as Role) {
    case "TUTOR":
      return { submission: { course: { tutor: { email } } } };
    case "STUDENT":
      return { student: { email } };
    case "ADMIN":
      return {};
    default:
      return null;
  }
}

// GET: fetch entries (optionally filtered by submissionId or studentId)
export async function GET(req: Request) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const visible = visibleEntriesWhere(guard.session);
  if (!visible) return forbidden();

  const { searchParams } = new URL(req.url);
  const submissionId = searchParams.get("submissionId");
  const studentId = searchParams.get("studentId");

  const where: Prisma.SubmissionEntryWhereInput = { AND: [visible] };
  const include = {
    student: true,
    grade: true,
    questionGrades: true,
  };

  if (submissionId && studentId) {
    const entry = await prisma.submissionEntry.findFirst({
      where: { submissionId, studentId, AND: [visible] },
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
  const guard = await requireApiRole("STUDENT");
  if (!guard.ok) return guard.response;

  const userId = guard.session.user.id;

  try {
    const data = await req.json();

    const student = await studentForSession(guard.session);
    if (!student || data.studentId !== student.id) {
      return forbidden("You can only submit for yourself");
    }

    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId },
      select: {
        id: true,
        title: true,
        courseId: true,
        isActive: true,
        course: {
          select: { students: { where: { id: student.id }, select: { id: true } } },
        },
      },
    });
    if (!submission || submission.course.students.length === 0) {
      return forbidden("You're not enrolled in this course");
    }
    if (!submission.isActive) {
      return forbidden("Assignment is not currently open");
    }

    const entry = await prisma.submissionEntry.create({
      data: {
        studentId: student.id,
        submissionId: submission.id,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
        attemptNumber: data.attemptNumber ?? 1,
        status: "SUBMITTED",
        feedback: "",
        fileUrl: Array.isArray(data.fileUrl) ? data.fileUrl : [],
      },
    });

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
    await prisma.notification.create({
      data: {
        title: "Assignment Submitted",
        message: `Your submission for "${submission.title}" has been received.`,
        link: `/dashboard/submissions/${submission.id}`,
        type: "SUBMISSION_DUE",
        studentId: student.id,
        courseId: submission.courseId,
      },
    });

    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
