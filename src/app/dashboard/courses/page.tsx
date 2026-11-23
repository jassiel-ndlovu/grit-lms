/**
 * /dashboard/courses — student's enrolled-courses page.
 *
 * Reduced from the legacy implementation: the heavy stats grid (completion
 * rate, upcoming deadlines, average grade) depended on tests/submissions/
 * lessons data that we'll migrate in later chapters. This page now does
 * the minimal thing well — show enrolled courses as cards. Stats can come
 * back once those features migrate to the new pattern.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CloudDownload, Search } from "lucide-react";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { joinRoutes } from "@/features/courses/lib/join-ui";
import { parentLanding } from "@/features/activity/lib/child-overview";
import { getViewer } from "@/lib/viewer";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCoursesByStudentId } from "@/features/courses/queries";
import { CourseCard } from "@/features/courses/components/course-card";
import { CourseGrid } from "@/features/courses/components/course-grid";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { getUserPreferences } from "@/features/users/preferences";

export const metadata = { title: "My courses" };

export default async function StudentCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  // Parents have no student pages; send them to their child (F7).
  if (session.user.role === "PARENT") redirect(parentLanding((await getViewer())?.children ?? []));

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!student) {
    return <PageMessage breadcrumb={[{ label: "My courses" }]}>No student profile found for this account.</PageMessage>;
  }

  const courses = await listCoursesByStudentId(student.id);

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "My courses" }]}
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href={studentCourseRoutes.saved}>
              <CloudDownload aria-hidden className="size-4" />
              Saved lessons
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={joinRoutes.browse}>
              <Search aria-hidden className="size-4" />
              Find courses
            </Link>
          </Button>
        </>
      }
    >
      <PageTitle icon={<BookOpen />} title="My courses" description="Continue learning where you left off." />

      <CourseGrid
        view={(await getUserPreferences(session.user.id)).preferredView}
        isEmpty={courses.length === 0}
        empty={
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-courses" />}
            title="You haven't enrolled in any courses yet"
            description="Browse the catalogue to find a course to enrol in."
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
    </PageFrame>
  );
}
