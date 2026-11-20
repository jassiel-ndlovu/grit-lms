/**
 * /dashboard/tutor-tests/new — tutor authors a new test.
 *
 * Server Component. Fetches the tutor's courses so the form's picker has
 * something to choose from, then renders <TestForm> in create mode.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";

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
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/tutor-tests">
            <ArrowLeft className="size-4" /> Back to tests
          </Link>
        </Button>
        <div className="border-input mt-6 rounded-md border border-dashed p-8 sm:p-12 text-center">
          <h1 className="font-display text-xl text-foreground">
            No courses yet
          </h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Create a course first — tests live inside a course.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/manage-courses">Go to manage courses</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader breadcrumb={[{ label: "Tests", href: "/dashboard/tutor-tests" }, { label: "New test" }]} />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <header>
          <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">New test</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Draft first, publish when ready. Publishing sends a notification to enrolled students.
          </p>
        </header>

        <TestForm courses={courses.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </>
  );
}
