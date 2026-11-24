/**
 * /dashboard/manage-courses — the tutor's courses; for an owner or admin,
 * every course in the workspace, each card naming its teacher (#192).
 *
 * Server Component: fetches the tutor's courses (and the student catalogue
 * for the create-course form) directly from the DB, then renders cards.
 * Mutations happen via Server Actions inside the create dialog and the
 * per-card actions menu.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { auth } from "@/lib/auth";

import { listCoursesByTutorId } from "@/features/courses/queries";
import { listWorkspaceStudents } from "@/features/students/queries";
import { workspaceIdFor } from "@/features/workspaces/tenancy";
import { can, getViewer } from "@/lib/viewer";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { getUserPreferences } from "@/features/users/preferences";
import { CourseActions } from "@/features/courses/components/course-actions";
import { CreateCourseButton } from "@/features/courses/components/create-course-button";
import { getCourseScope } from "@/features/courses/course-access";

export const metadata = { title: "Courses" };

export default async function ManageCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  // Courses this user teaches; owners and admins see the whole workspace (#192).
  const scope = await getCourseScope(session.user.id);

  const viewer = await getViewer();
  // An assistant tutor edits courses but doesn't create or delete them.
  const creates = viewer != null && can(viewer, "courses.create");
  const [courses, students] = await Promise.all([listCoursesByTutorId(scope), listWorkspaceStudents(viewer ? workspaceIdFor(viewer) : null)]);

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Courses" }]}
      actions={creates ? <CreateCourseButton students={students} /> : null}
    >
      <PageTitle title="Courses" description={creates ? "Create courses, add students to them, and write their lessons." : "The courses you teach or manage. Open one to write lessons and set work."} />

      <CourseGrid
        view={(await getUserPreferences(session.user.id)).preferredView}
        isEmpty={courses.length === 0}
        empty={
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-courses" />}
            title="No courses yet"
            description={
              creates
                ? "Choose New course to create one. Then add lessons, tests and students."
                : "When someone adds you to a course, it shows here."
            }
          />
        }
      >
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            href={`/dashboard/manage-courses/${course.id}`}
            actions={
              <CourseActions courseId={course.id} courseName={course.name} canDelete={creates} />
            }
          />
        ))}
      </CourseGrid>
    </PageFrame>
  );
}
