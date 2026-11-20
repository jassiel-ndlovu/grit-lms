/**
 * /dashboard/manage-courses — tutor's listing of their own courses.
 *
 * Server Component: fetches the tutor's courses (and the student catalogue
 * for the create-course form) directly from the DB, then renders cards.
 * Mutations happen via Server Actions inside the create dialog and the
 * per-card actions menu.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { listCoursesByTutorId } from "@/features/courses/queries";
import { listAllStudents } from "@/features/students/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { getUserPreferences } from "@/features/users/preferences";
import { CourseActions } from "@/features/courses/components/course-actions";
import { CreateCourseButton } from "@/features/courses/components/create-course-button";
import { teacherFrom } from "@/features/courses/lib/teacher";

export const metadata = { title: "Manage courses" };

export default async function ManageCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  // The Tutor row is keyed by email — same lookup the legacy POST used.
  const tutor = teacherFrom(session.user);


  const [courses, students] = await Promise.all([
    listCoursesByTutorId(tutor.id),
    listAllStudents(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight tracking-tight text-foreground">
            Manage courses
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Create courses, manage enrolment, and edit content.
          </p>
        </div>
        <CreateCourseButton students={students} />
      </div>

      <CourseGrid
        view={(await getUserPreferences(session.user.id)).preferredView}
        isEmpty={courses.length === 0}
        empty={
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-courses" />}
            title="No courses yet"
            description="Create your first course to start adding lessons and assessments, and enrolling students."
          />
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
