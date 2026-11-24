/**
 * /dashboard/tutor-tests — tutor's listing of their tests across courses.
 *
 * Server Component. PageFrame (Import JSON and New test as actions), then
 * a table: test and course, status, due, questions, submissions, points,
 * actions. A published test opens on its submissions, a draft on its
 * questions.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { listTestsByTutorId } from "@/features/assessments/queries";
import { listCoursesByTutorId } from "@/features/courses/queries";
import { TutorTestActions } from "@/features/assessments/components/tutor-test-actions";
import { WriteGuard } from "@/components/shell/workspace-access";
import { ImportTestDialog } from "@/features/assessments/components/import-test-dialog";
import { testRoutes } from "@/features/assessments/components/test-frame";
import { getCourseScope } from "@/features/courses/course-access";
import { schoolDateFormat } from "@/lib/datetime";

export const metadata = { title: "Tests" };

const dateFmt = schoolDateFormat({
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function TutorTestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const scope = await getCourseScope(session.user.id);

  const [tests, courses] = await Promise.all([
    listTestsByTutorId(scope),
    listCoursesByTutorId(scope),
  ]);

  // Sort published-first, then by due date descending so the tutor's
  // current-term tests dominate the top of the table.
  const rows = [...tests].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.dueDate.getTime() - a.dueDate.getTime();
  });

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Tests" }]}
      actions={
        <>
          <WriteGuard label="Import JSON">
            <ImportTestDialog courses={courses.map((c) => ({ id: c.id, name: c.name }))} />
          </WriteGuard>
          <WriteGuard label="New test" variant="brand">
            <Button asChild variant="brand" size="sm">
              <Link href={testRoutes.create}>
                <Plus className="size-4" /> New test
              </Link>
            </Button>
          </WriteGuard>
        </>
      }
    >
      <PageTitle
        title="Tests"
        description={rows.length > 0 ? `${rows.length} ${rows.length === 1 ? "test" : "tests"}` : undefined}
      />

      {rows.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <EmptyState
            illustration={<Scene name="empty-tests" />}
            title="No tests yet"
            description="Tests you create from New test will show up here."
          />
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <Th className="w-[36%]">Test</Th>
                <Th>Status</Th>
                <Th>Due</Th>
                <Th align="right">Questions</Th>
                <Th align="right">Submissions</Th>
                <Th align="right">Points</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                  <Td>
                    <Link href={t.isActive ? testRoutes.submissions(t.id) : testRoutes.questions(t.id)} className="block">
                      <p className="text-foreground leading-tight font-medium">{t.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{t.course.name}</p>
                    </Link>
                  </Td>
                  <Td>
                    <StatusChip tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "Published" : "Draft"}</StatusChip>
                  </Td>
                  <Td>
                    <span className="text-muted-foreground text-xs tabular-nums">{dateFmt.format(t.dueDate)}</span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums">{t._count.questions}</span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums">{t._count.submissions}</span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums">{t.totalPoints}</span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end">
                      <TutorTestActions testId={t.id} testTitle={t.title} courseId={t.courseId} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageFrame>
  );
}

function Th({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <th
      className={`${className ?? ""} px-4 py-2 text-left font-medium ${
        align === "right" ? "text-right" : ""
      }`}
      scope="col"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td className={`px-4 py-3 align-middle ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}
