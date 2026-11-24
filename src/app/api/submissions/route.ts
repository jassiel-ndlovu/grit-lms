/**
 * /api/submissions — legacy route for the client pages under
 * /dashboard/submissions (create, overview, portal, review).
 *
 * POST mirrors `createSubmission` in `src/features/submissions/actions.ts`:
 * tutor only, and the tutor must own the course. GET is retired: no page
 * reads assignments through this URL.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitNotification } from "@/features/notifications/server";
import {
  forbidden,
  gone,
  requireApiStaffWrite,
  tutorOwnsCourse,
} from "@/lib/api-guard";

/** Retired: assignments are read through `src/features/assignments/queries.ts`. */
export function GET() {
  return gone("Read assignments through src/features/assignments/queries.ts.");
}

// POST /api/submissions
export async function POST(req: Request) {
  const guard = await requireApiStaffWrite("TUTOR");
  if (!guard.ok) return guard.response;

  const body = await req.json();

  if (!(await tutorOwnsCourse(guard.session, body.courseId))) {
    return forbidden("You don't own this course");
  }

  const submission = await prisma.submission.create({
    data: {
      title: body.title,
      fileType: body.fileType,
      description: body.description,
      descriptionFiles: body.descriptionFiles,
      lastDueDate: body.lastDueDate ? new Date(body.lastDueDate) : null,
      courseId: body.courseId,
      maxAttempts: body.maxAttempts,
      totalPoints: body.totalPoints,
      isActive: body.isActive,
      dueDate: new Date(body.dueDate),
      createdAt: new Date(Date.now()),
    },
  });

  await emitNotification(
    {
      title: "New Submission",
      message: `Assignment "${submission.title}" has been created.`,
      link: `/dashboard/submissions/${submission.id}`,
      type: "SUBMISSION_CREATED",
      courseId: submission.courseId,
    },
    { revalidate: false },
  );

  return NextResponse.json(submission);
}
