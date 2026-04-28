/**
 * /dashboard/manage-courses — tutor's listing of their own courses.
 *
 * Server Component: fetches the tutor's courses (and the student catalogue
 * for the create-course form) directly from the DB, then renders cards.
 * Mutations happen via Server Actions inside the create dialog and the
 * per-card actions menu.
 */

import { redirect } from "next/navigation";
import { ImageIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { listCoursesByTutorId } from "@/features/courses/queries";
import { listAllStudents } from "@/features/students/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";
import { CourseActions } from "@/features/courses/components/course-actions";
import { CreateCourseButton } from "@/features/courses/components/create-course-button";

export const metadata = { title: "Manage courses" };

export default async function ManageCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  // The Tutor row is keyed by email — same lookup the legacy POST used.
  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const [courses, students] = await Promise.all([
    listCoursesByTutorId(tutor.id),
    listAllStudents(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Manage courses
          </h1>
          <p className="text-muted-foreground text-sm">
            Create courses, manage enrolment, and edit content.
          </p>
        </div>
        <CreateCourseButton students={students} />
      </div>

      <CourseGrid
        isEmpty={courses.length === 0}
        empty={
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <ImageIcon className="text-muted-foreground mx-auto size-10" />
            <h3 className="mt-3 text-base font-medium">No courses yet</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Create your first course to start adding lessons, assessments,
              and enrolling students.
            </p>
          </div>
        }
      >
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            href={`/dashboard/manage-courses/${course.id}`}
            actions={
              <CourseActions courseId={course.id} courseName={course.name} />
            }
          />
        ))}
      </CourseGrid>
    </div>
  );
}
