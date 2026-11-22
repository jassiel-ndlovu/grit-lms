/**
 * /dashboard/students — the workspace's students and "Add a student"
 * (#174; a/ux/01, section 6). Owners and admins see everyone; a tutor sees
 * the students on their courses. Adding uses A's createStudentAccount and
 * shows the sign-in card once.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileUp } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { importRoutes } from "@/components/imports/import-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddStudentForm } from "@/features/courses/components/accounts/add-student-form";
import { coursesForAdding, listRoster } from "@/features/courses/lib/roster";
import { can, getViewer } from "@/lib/viewer";
import { needsScope } from "@/lib/viewer-core";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "learners.invite")) redirect("/dashboard");

  const [students, courses] = await Promise.all([listRoster(viewer), coursesForAdding(viewer)]);
  const scoped = needsScope(viewer, "learners.invite");

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Students" }]}
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <a href="/api/exports/students" download>
              <Download className="size-3.5" /> Export CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={importRoutes.start("students")}>
              <FileUp className="size-3.5" /> Import students
            </Link>
          </Button>
        </>
      }
    >
      <PageTitle
        title="Students"
        description={
          <>
            {scoped ? "Students on your courses." : `Everyone learning at ${viewer.workspace.name}.`} Add a student and hand them a
            sign-in card; they don&apos;t need an email.
          </>
        }
      />

      <section aria-labelledby="add-heading" className="border-border space-y-4 rounded-lg border p-5">
        <h2 id="add-heading" className="text-foreground text-sm font-semibold">
          Add a student
        </h2>
        <AddStudentForm courses={courses} workspaceName={viewer.workspace.name} coursesRequired={scoped} />
      </section>

      <section aria-labelledby="list-heading" className="space-y-3">
        <h2 id="list-heading" className="text-foreground text-sm font-semibold">
          {students.length === 1 ? "1 student" : `${students.length} students`}
        </h2>
        {students.length === 0 ? (
          <p className="text-muted-foreground text-sm">No students yet.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {students.map((s) => (
              <li key={s.learnerId}>
                <Link
                  href={`/dashboard/students/${s.learnerId}`}
                  className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-foreground block font-medium">{s.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {[s.username, s.email].filter(Boolean).join(" · ") || "No username or email"}
                      {s.courses.length ? ` · ${s.courses.map((c) => c.name).join(", ")}` : ""}
                    </span>
                  </span>
                  {s.deleteOn ? (
                    <Badge variant="destructive">Deletion pending</Badge>
                  ) : s.awaitingFirstSignIn ? (
                    <Badge variant="outline">Hasn&apos;t signed in yet</Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageFrame>
  );
}
