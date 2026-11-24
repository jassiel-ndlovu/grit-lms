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
import { aiHelpForTests } from "@/features/courses/ai-help";
import { getCourseScope } from "@/features/courses/course-access";
import { hasService } from "@/features/billing/services";
import { getViewer } from "@/lib/viewer";

/** Drafting questions with AI can take a minute. */
export const maxDuration = 120;

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
          description="Every test belongs to a course, so create a course first."
          action={
            <Button asChild>
              <Link href="/dashboard/manage-courses">Go to your courses</Link>
            </Button>
          }
        />
      </PageFrame>
    );
  }

  // The Plus question bank, per course (contracts/question-bank.md).
  const viewer = await getViewer();
  const withBank = viewer ? await Promise.all(courses.map(async (c) => ((await hasService(viewer, c.id, "question-bank")) ? c.id : null))) : [];
  const bank = new Set(withBank.filter(Boolean));
  // AI help for tutors (Plus), per course.
  const ai = await aiHelpForTests(viewer, courses.map((c) => c.id));

  return (
    <PageFrame type="editor" breadcrumb={[{ label: "Tests", href: "/dashboard/tutor-tests" }, { label: "New test" }]}>
      <PageTitle title="New test" description="Save it as a draft while you work on it. When you publish it, the course's students get a notification and can take it." />

      <TestForm courses={courses.map((c) => ({ id: c.id, name: c.name, curriculum: { curriculum: c.curriculum, subject: c.subject, gradeLevel: c.gradeLevel }, questionBank: bank.has(c.id), ai: ai.get(c.id) ?? null }))} />
    </PageFrame>
  );
}
