/**
 * /dashboard/browse-courses — public-ish catalogue of every course on the
 * platform. Server Component: data is fetched on the server and the page
 * renders without client-side state.
 *
 * Search/filter UI was removed in this migration — the legacy version
 * filtered client-side after pulling everything anyway, and we don't yet
 * have a category column. Add server-driven search in a later chapter
 * once we know the real query patterns.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listAllCourses } from "@/features/courses/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";
import { getUserPreferences } from "@/features/users/preferences";
import { EmptyState, Scene } from "@/components/ui/empty-state";

export const metadata = { title: "Browse courses" };

export default async function BrowseCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const courses = await listAllCourses();

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl leading-tight tracking-tight text-foreground">
          Browse courses
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Explore the full catalogue of available courses.
        </p>
      </header>

      <CourseGrid
        view={(await getUserPreferences(session.user.id)).preferredView}
        isEmpty={courses.length === 0}
        empty={
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-courses" />}
            title="No courses yet"
            description="The catalogue is empty. Check back soon."
          />
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
