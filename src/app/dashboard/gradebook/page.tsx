/**
 * /dashboard/gradebook — tutor picks a course.
 *
 * Server Component. Tutor-only; students keep using /dashboard/grades.
 */

import { SaverCover } from "@/components/data-saver";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight, FileText, Users } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { listGradebookCoursesForTutor } from "@/features/grades/gradebook";
import { reportRoutes } from "@/features/grades/lib/term-report";
import { reportStaff } from "@/features/grades/term-reports";
import { getCourseScope } from "@/features/courses/course-access";
import { courseCoverSrc } from "@/features/courses/lib/stock-covers";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Gradebook" };

export default async function GradebookIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard/grades");

  // Reading marks: wider than editing for an executive (viewer.md, "Roles and branches").
  const scope = await getCourseScope(session.user.id, "grades.view");

  const courses = await listGradebookCoursesForTutor(scope);

  const viewer = await getViewer();
  const reports =
    viewer && reportStaff(viewer) ? (
      <Button asChild size="sm" variant="outline">
        <Link href={reportRoutes.home}>
          <FileText aria-hidden className="size-4" />
          Term reports
        </Link>
      </Button>
    ) : undefined;

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Gradebook" }]} actions={reports}>
      <PageTitle title="Gradebook" description="Every student's marks on each course, and what each test and assignment counts towards the final mark." />

      {courses.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <BookOpen className="text-muted-foreground mx-auto size-10" />
          <h2 className="font-display mt-3 text-lg text-foreground">
            No courses yet
          </h2>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
            Create a course, then add tests and assignments. Marks show here as you mark them.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/gradebook/${c.id}`} className="block">
                <Card className="hover:border-brand-terracotta/40 flex flex-row items-center gap-4 p-5 transition-colors">
                  <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
                    <SaverCover
                      src={courseCoverSrc(c)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {c.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {c._count.enrollments}
                      </span>
                      <span className="tabular-nums">
                        {c._count.tests + c._count.submissions} tests and assignments
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
