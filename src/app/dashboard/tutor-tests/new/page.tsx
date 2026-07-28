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
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";

import { listCoursesByTutorId } from "@/features/courses/queries";
import { TestForm } from "@/features/assessments/components/test-form";

export const metadata = { title: "New test" };

export default async function NewTestPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

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

  const courses = await listCoursesByTutorId(tutor.id);
  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/tutor-tests">
            <ArrowLeft className="size-4" /> Back to tests
          </Link>
        </Button>
        <div className="border-input mt-6 rounded-md border border-dashed p-12 text-center">
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
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/tutor-tests">
                <ArrowLeft className="size-4" /> Back to tests
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <header>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            New test
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Draft first, publish when ready. Publishing sends a notification
            to enrolled students.
          </p>
        </header>

        <TestForm
          courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
