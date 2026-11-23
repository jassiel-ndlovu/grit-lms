/**
 * /api/submissions/[id] — legacy update/delete for the client pages under
 * /dashboard/submissions. Mirrors `updateSubmission` / `deleteSubmission` in
 * `src/features/submissions/actions.ts`: tutor only, and the tutor must own
 * the assignment's course.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

import { NextResponse } from "next/server";
import type { Session } from "@/lib/auth";

import { taughtByEmail } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { emitNotification } from "@/features/notifications/server";
import { forbidden, requireApiStaffWrite } from "@/lib/api-guard";

async function tutorOwnsSubmission(session: Session, id: string) {
  // Teaching is read from CourseStaff, not Course.tutorId (issue #93).
  const existing = await prisma.submission.findFirst({
    where: { id, course: taughtByEmail(session.user.email) },
    select: { id: true },
  });
  return existing != null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiStaffWrite("TUTOR");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const { id } = await params;

  if (!(await tutorOwnsSubmission(guard.session, id))) {
    return forbidden("You don't own this assignment");
  }

  const submission = await prisma.submission.update({
    where: { id: id },
    data: {
      title: body.title,
      fileType: body.fileType,
      maxAttempts: body.maxAttempts,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });

  await emitNotification(
  {
    title: "Submission Updated",
    message: `The submission "${submission.title}" has been updated.`,
    link: `/dashboard/submissions/${submission.id}`,
    type: "SUBMISSION_UPDATED",
    courseId: submission.courseId,
  },
  { revalidate: false },
);

  return NextResponse.json(submission);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiStaffWrite("TUTOR");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  if (!(await tutorOwnsSubmission(guard.session, id))) {
    return forbidden("You don't own this assignment");
  }

  const submission = await prisma.submission.delete({ where: { id: id } });

  await emitNotification(
    {
      title: "Submission Deleted",
      message: `The submission "${submission.title}" has been removed.`,
      type: "SUBMISSION_DELETED",
      courseId: submission.courseId,
    },
    { revalidate: false },
  );

  return NextResponse.json({ success: true });
}
