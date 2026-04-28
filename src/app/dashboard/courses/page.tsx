/**
 * /dashboard/courses — student's enrolled-courses page.
 *
 * Reduced from the legacy implementation: the heavy stats grid (completion
 * rate, upcoming deadlines, average grade) depended on tests/submissions/
 * lessons data that we'll migrate in later chapters. This page now does
 * the minimal thing well — show enrolled courses as cards. Stats can come
 * back once those features migrate to the new pattern.
 */

import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCoursesByStudentId } from "@/features/courses/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";

export const metadata = { title: "My courses" };

export default async function StudentCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const courses = await listCoursesByStudentId(student.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          My courses
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Continue learning where you left off.
        </p>
      </header>

      <CourseGrid
        isEmpty={courses.length === 0}
        empty={
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <BookOpen className="text-muted-foreground mx-auto size-10" />
            <h3 className="font-display mt-3 text-lg text-foreground">
              You haven&apos;t enrolled in any courses yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
              Browse the catalogue to find a course to enrol in.
            </p>
          </div>
        }
      >
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            href={`/dashboard/courses/${course.id}`}
          />
        ))}
      </CourseGrid>
    </div>
  );
}
