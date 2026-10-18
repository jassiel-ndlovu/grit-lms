/**
 * /api/courses — legacy READ endpoint.
 *
 * The POST handler has been retired in favour of the createCourse Server
 * Action in `@/features/courses/actions`. The GET handler remains to keep
 * the legacy CourseContext working until every consumer is migrated to
 * the new RSC + queries pattern. Once all consumers are migrated this
 * file can be deleted in full.
 *
 * GET only returns courses the caller can see: a tutor's own courses, a
 * student's enrolled courses, or all of them for an admin.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { forbidden, requireApiSession, visibleCoursesWhere } from "@/lib/api-guard";

const fullInclude = {
  tutor: true,
  students: true,
  lessons: { include: { attachmentUrls: true } },
  quizzes: true,
  tests: true,
  submissions: true,
  courseEvents: true,
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const visible = visibleCoursesWhere(guard.session);
  if (!visible) return forbidden();

  const tutorId = req.nextUrl.searchParams.get("tutorId");
  const studentId = req.nextUrl.searchParams.get("studentId");
  const courseIds = req.nextUrl.searchParams.get("ids");

  if (tutorId) {
    const courses = await prisma.course.findMany({
      where: { tutorId, AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(courses);
  }

  if (studentId) {
    const courses = await prisma.course.findMany({
      where: { students: { some: { id: studentId } }, AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(courses);
  }

  if (courseIds) {
    const ids = courseIds.split(",").filter(Boolean);
    const courses = await prisma.course.findMany({
      where: { id: { in: ids }, AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(courses);
  }

  const courses = await prisma.course.findMany({
    where: visible,
    include: fullInclude,
  });
  return NextResponse.json(courses);
}
