/**
 * /dashboard/tutor-tests/new — tutor authors a new test.
 *
 * Server Component. Fetches the tutor's courses so the form's picker has
 * something to choose from, then renders <TestForm> in create mode.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";

import { listCoursesByTutorId } from "@/features/courses/queries";
import { TestForm } from "@/features/assessments/components/test-form";
import { getCourseScope } from "@/features/courses/course-access";

export const metadata = { title: "New test" };

export default async function NewTestPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const scope = await getCourseScope(session.user.id);

  const courses = await listCoursesByTutorId(scope);
  if (courses.length === 0) {
    return (
      <PageFrame type="settings" breadcrumb={[{ label: "Tests", href: "/dashboard/tutor-tests" }, { label: "New test" }]}>
        <PageTitle title="New test" />
        <EmptyState
          className="border-input rounded-lg border border-dashed"
          illustration={<Scene name="empty-courses" />}
          title="No courses yet"
          description="Create a course first: tests live inside a course."
          action={
            <Button asChild>
              <Link href="/dashboard/manage-courses">Go to your courses</Link>
            </Button>
          }
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame type="editor" breadcrumb={[{ label: "Tests", href: "/dashboard/tutor-tests" }, { label: "New test" }]}>
      <PageTitle title="New test" description="Draft first, publish when ready. Publishing sends a notification to enrolled students." />

      <TestForm courses={courses.map((c) => ({ id: c.id, name: c.name }))} />
    </PageFrame>
  );
}
