/**
 * /api/submissions — legacy route for the client pages under
 * /dashboard/submissions (create, overview, portal, review).
 *
 * GET only returns assignments in courses the caller can see (own courses
 * for a tutor, enrolled courses for a student). POST mirrors
 * `createSubmission` in `src/features/submissions/actions.ts`: tutor only,
 * and the tutor must own the course.
 *
 * TODO[chapter-3-cleanup]: drop this file once those pages are retired.
 */

import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  forbidden,
  requireApiRole,
  requireApiSession,
  tutorOwnsCourse,
  visibleCoursesWhere,
} from "@/lib/api-guard";

export async function GET(req: Request) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const visible = visibleCoursesWhere(guard.session);
  if (!visible) return forbidden();

  const { searchParams } = new URL(req.url);
  const courseIds = searchParams.get("courseIds");
  const courseId = searchParams.get("courseId");
  const tutorId = searchParams.get("tutorId");
  const studentId = searchParams.get("studentId");
  const subId = searchParams.get("id");

  const findVisible = (course: Prisma.CourseWhereInput) =>
    prisma.submission.findMany({
      where: { course: { AND: [course, visible] } },
      orderBy: { dueDate: "asc" },
    });

  if (courseId && studentId) {
    return NextResponse.json(
      await findVisible({ id: courseId, students: { some: { id: studentId } } }),
    );
  } else if (courseIds) {
    return NextResponse.json(await findVisible({ id: { in: courseIds.split(",") } }));
  } else if (studentId) {
    return NextResponse.json(
      await findVisible({ students: { some: { id: studentId } } }),
    );
  } else if (tutorId) {
    return NextResponse.json(await findVisible({ tutorId }));
  } else if (subId) {
    const submission = await prisma.submission.findFirst({
      where: { id: subId, course: visible },
    });

    return NextResponse.json(submission);
  }

  return NextResponse.json({ error: "Submission not found" }, { status: 404 });
}

// POST /api/submissions
export async function POST(req: Request) {
  const guard = await requireApiRole("TUTOR");
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

  await prisma.notification.create({
    data: {
      title: "New Submission",
      message: `Assignment "${submission.title}" has been created.`,
      link: `/dashboard/submissions/${submission.id}`,
      type: "SUBMISSION_CREATED",
      courseId: submission.courseId,
    },
  });

  return NextResponse.json(submission);
}
