/**
 * /api/submission-entry/[id] — legacy route for the client pages under
 * /dashboard/submissions.
 *
 * PUT is the student resubmitting from /dashboard/submissions/portal: the
 * student must own the entry, and may only change their files and attempt
 * (as `submitEntry` in `src/features/submissions/actions.ts` does). DELETE
 * is the tutor removing an entry from /dashboard/submissions/overview: the
 * tutor must own the assignment's course. GET is retired — nothing reads a
 * single entry through this URL.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { forbidden, gone, requireApiRole } from "@/lib/api-guard";

/**
 * Retired — entries are read through `src/features/submissions/queries.ts`.
 */
export function GET() {
  return gone("Read entries through src/features/submissions/queries.ts.");
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole("STUDENT");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const existing = await prisma.submissionEntry.findUnique({
    where: { id },
    select: { student: { select: { email: true } }, submission: { select: { isActive: true } } },
  });
  if (existing?.student.email !== guard.session.user.email) {
    return forbidden("You don't own this entry");
  }
  if (!existing.submission.isActive) {
    return forbidden("Assignment is not currently open");
  }

  try {
    const data = await req.json();
    const entry = await prisma.submissionEntry.update({
      where: { id: id },
      data: {
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
        status: "SUBMITTED",
        attemptNumber: data.attemptNumber ?? undefined,
        fileUrl: Array.isArray(data.fileUrl) ? data.fileUrl : undefined,
      },
    });
    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole("TUTOR");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const existing = await prisma.submissionEntry.findUnique({
    where: { id },
    select: {
      submission: { select: { course: { select: { tutor: { select: { email: true } } } } } },
    },
  });
  if (existing?.submission.course.tutor.email !== guard.session.user.email) {
    return forbidden("You don't own this assignment");
  }

  try {
    await prisma.submissionEntry.delete({ where: { id: id } });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
