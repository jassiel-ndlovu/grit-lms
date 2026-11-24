/**
 * /api/submission-entry — legacy route for the client pages under
 * /dashboard/submissions (portal, review, overview).
 *
 * POST mirrors `submitEntry` in `src/features/submissions/actions.ts`:
 * student only, for themselves, on an open assignment in a course they're
 * enrolled in. GET is retired: no page reads entries through this URL.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";

import { enrollmentFor } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { notifyHandIn } from "@/features/notifications/server";
import {
  forbidden,
  gone,
  requireApiRole,
  studentForSession,
} from "@/lib/api-guard";

/** Retired: entries are read through `src/features/assignments/queries.ts`. */
export function GET() {
  return gone("Read entries through src/features/assignments/queries.ts.");
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
          select: { enrollments: enrollmentFor(student.id) },
        },
      },
    });
    if (!submission || submission.course.enrollments.length === 0) {
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

    // Receipt to the student, alert to the tutor (preference-aware).
    await notifyHandIn({
      kind: "assignment",
      title: submission.title,
      courseId: submission.courseId,
      studentId: student.id,
      studentLink: `/dashboard/submissions/${submission.id}`,
      tutorLink: `/dashboard/submissions/overview/${submission.id}/${student.id}`,
    });

    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
