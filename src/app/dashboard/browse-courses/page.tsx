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
import { Search } from "lucide-react";

import { auth } from "@/lib/auth";
import { listAllCourses } from "@/features/courses/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";

export const metadata = { title: "Browse courses" };

export default async function BrowseCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const courses = await listAllCourses();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          Browse courses
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Explore the full catalogue of available courses.
        </p>
      </header>

      <CourseGrid
        isEmpty={courses.length === 0}
        empty={
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <Search className="text-muted-foreground mx-auto size-10" />
            <h3 className="font-display mt-3 text-lg text-foreground">
              No courses yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
              The catalogue is empty. Check back soon.
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
