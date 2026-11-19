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

import type { Prisma } from "@/generated/prisma";
import { enrolledStudent, taughtBy } from "@/features/courses/lib/tenancy-where";
import { prisma } from "@/lib/db";
import { forbidden, requireApiSession, visibleCoursesWhere } from "@/lib/api-guard";

// Teacher and students come from the tenancy tables (issue #93); the
// response keeps the old `tutor` and `students` fields for CourseContext.
const fullInclude = {
  ownerMembership: { select: { user: { select: { tutorProfile: true } } } },
  enrollments: { where: { endedAt: null }, select: { learner: { select: { user: { select: { studentProfile: true } } } } } },
  lessons: { include: { attachmentUrls: true } },
  quizzes: true,
  tests: true,
  submissions: true,
  courseEvents: true,
} as const;

type WithLinks = Prisma.CourseGetPayload<{ include: typeof fullInclude }>;

/** The old response shape: `tutor` (Tutor profile) and `students` (Student profiles). */
function legacyShape(courses: WithLinks[]) {
  return courses.map(({ ownerMembership, enrollments, ...course }) => ({
    ...course,
    tutor: ownerMembership?.user.tutorProfile ?? null,
    students: enrollments.map((e) => e.learner.user.studentProfile).filter((s) => s != null),
  }));
}

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
      where: { ...taughtBy(tutorId), AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(legacyShape(courses));
  }

  if (studentId) {
    const courses = await prisma.course.findMany({
      where: { ...enrolledStudent(studentId), AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(legacyShape(courses));
  }

  if (courseIds) {
    const ids = courseIds.split(",").filter(Boolean);
    const courses = await prisma.course.findMany({
      where: { id: { in: ids }, AND: [visible] },
      include: fullInclude,
    });
    return NextResponse.json(legacyShape(courses));
  }

  const courses = await prisma.course.findMany({
    where: visible,
    include: fullInclude,
  });
  return NextResponse.json(legacyShape(courses));
}
