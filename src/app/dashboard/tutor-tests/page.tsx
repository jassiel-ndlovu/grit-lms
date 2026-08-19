/**
 * /dashboard/tutor-tests — tutor's listing of their tests across courses.
 *
 * Server Component. Table layout: each row is a test, columns are Title +
 * course, Status, Due, Questions, Submissions, Points, Actions. Header
 * has Import JSON + New test buttons.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Target } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { listTestsByTutorId } from "@/features/assessments/queries";
import { listCoursesByTutorId } from "@/features/courses/queries";
import { TutorTestActions } from "@/features/assessments/components/tutor-test-actions";
import { ImportTestDialog } from "@/features/assessments/components/import-test-dialog";

export const metadata = { title: "Tests & Grading" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function TutorTestsPage() {
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

  const [tests, courses] = await Promise.all([
    listTestsByTutorId(tutor.id),
    listCoursesByTutorId(tutor.id),
  ]);

  // Sort published-first, then by due date descending so the tutor's
  // current-term tests dominate the top of the table.
  const rows = [...tests].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.dueDate.getTime() - a.dueDate.getTime();
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            Tests &amp; grading
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Every test you have authored. Click a row to view submissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportTestDialog
            courses={courses.map((c) => ({ id: c.id, name: c.name }))}
          />
          <Button asChild variant="brand">
            <Link href="/dashboard/tutor-tests/new">
              <Plus className="size-4" /> New test
            </Link>
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <Target className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No tests yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Tests you create from &ldquo;New test&rdquo; will show up here.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 py-4">
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Your tests
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {rows.length} total
            </span>
          </div>
          <Separator />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <Th className="w-[36%]">Title</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                  <Th align="right">Questions</Th>
                  <Th align="right">Submissions</Th>
                  <Th align="right">Points</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                    <Td>
                      <Link
                        href={`/dashboard/tutor-tests/${t.id}/submissions`}
                        className="block"
                      >
                        <p className="text-foreground font-medium leading-tight">
                          {t.title}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.course.name}
                        </p>
                      </Link>
                    </Td>
                    <Td>
                      <Badge variant={t.isActive ? "soft" : "secondary"}>
                        {t.isActive ? "Published" : "Draft"}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {dateFmt.format(t.dueDate)}
                      </span>
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
                        <TutorTestActions
                          testId={t.id}
                          testTitle={t.title}
                          courseId={t.courseId}
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
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
