/**
 * /dashboard/submissions — student catalogue of assignments across enrolled
 * courses. Tutors land here too but see their own assignments-by-course view.
 *
 * Server Component. Replaces the legacy student-submissions / tutor-submissions
 * client components in one role-branched RSC page.
 */

import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getEntryByStudentAndSubmission,
  listActiveSubmissionsForStudent,
  listSubmissionsByTutorId,
} from "@/features/submissions/queries";
import { SubmissionCard } from "@/features/submissions/components/submission-card";
import { SubmissionGrid } from "@/features/submissions/components/submission-grid";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TutorSubmissionActions } from "@/features/submissions/components/tutor-submission-actions";

export const metadata = { title: "Submissions" };

// Sort assignments so the student sees items requiring action first, then
// awaiting-grade, then completed. Mirrors the ordering on /dashboard/tests.
const SUBMISSION_STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  NOT_STARTED: 1,
  NOT_SUBMITTED: 1,
  LATE: 2,
  SUBMITTED: 3,
  GRADED: 4,
};
function statusKey(status: string | null | undefined, dueDate: Date): string {
  if (!status) {
    return dueDate.getTime() < Date.now() ? "LATE" : "NOT_STARTED";
  }
  return status;
}

export default async function SubmissionsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  if (session.user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!student) {
      return (
        <div className="text-muted-foreground p-8 text-sm">
          No student profile found for this account.
        </div>
      );
    }

    const subs = await listActiveSubmissionsForStudent(student.id);
    const entries = await Promise.all(
      subs.map((s) => getEntryByStudentAndSubmission(student.id, s.id)),
    );

    // Zip + sort by status priority so needs-action items float to the top.
    const rows = subs
      .map((sub, i) => ({ sub, entry: entries[i] }))
      .sort((a, b) => {
        const aStatus = statusKey(a.entry?.status, a.sub.dueDate);
        const bStatus = statusKey(b.entry?.status, b.sub.dueDate);
        const orderDiff =
          (SUBMISSION_STATUS_ORDER[aStatus] ?? 5) -
          (SUBMISSION_STATUS_ORDER[bStatus] ?? 5);
        if (orderDiff !== 0) return orderDiff;
        return a.sub.dueDate.getTime() - b.sub.dueDate.getTime();
      });

    return (
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            Submissions
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Active assignments across your courses.
          </p>
        </header>

        <SubmissionGrid
          isEmpty={subs.length === 0}
          empty={
            <div className="border-input rounded-lg border border-dashed p-12 text-center">
              <Pencil className="text-muted-foreground mx-auto size-10" />
              <h3 className="font-display mt-3 text-lg text-foreground">
                Nothing to submit
              </h3>
              <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
                Assignments your tutors publish will show up here.
              </p>
            </div>
          }
        >
          {rows.map(({ sub: s, entry }) => {
            return (
              <SubmissionCard
                key={s.id}
                submission={s}
                entry={
                  entry
                    ? {
                        status: entry.status as
                          | "NOT_STARTED"
                          | "IN_PROGRESS"
                          | "SUBMITTED"
                          | "GRADED"
                          | "LATE"
                          | "NOT_SUBMITTED",
                        attemptNumber: entry.attemptNumber,
                        grade: entry.grade
                          ? {
                              score: entry.grade.score,
                              outOf: entry.grade.outOf,
                            }
                          : null,
                      }
                    : null
                }
                href={`/dashboard/submissions/${s.id}`}
              />
            );
          })}
        </SubmissionGrid>
      </div>
    );
  }

  if (session.user.role === "TUTOR") {
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

    const subs = await listSubmissionsByTutorId(tutor.id);

    // Sort active-first, newest due first — mirrors the tutor tests table.
    const rows = [...subs].sort((a, b) => {
      if (Boolean(a.isActive) !== Boolean(b.isActive)) return a.isActive ? -1 : 1;
      return b.dueDate.getTime() - a.dueDate.getTime();
    });

    return (
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
              Assignments
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Every assignment you&apos;ve published, newest due-date first.
            </p>
          </div>
          <Button asChild variant="brand">
            <Link href="/dashboard/manage-courses">
              <Plus className="size-4" /> New assignment
            </Link>
          </Button>
        </header>

        {rows.length === 0 ? (
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <Pencil className="text-muted-foreground mx-auto size-10" />
            <h3 className="font-display mt-3 text-lg text-foreground">
              No assignments yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
              Create one from a course&apos;s manage page.
            </p>
          </div>
        ) : (
          <div className="border-border overflow-hidden rounded-lg border bg-card">
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
                Your assignments
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
                    <th className="w-[40%] px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Due</th>
                    <th className="px-4 py-2 text-right font-medium">Entries</th>
                    <th className="px-4 py-2 text-right font-medium">Points</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/submissions/${sub.id}`}
                          className="block"
                        >
                          <p className="text-foreground font-medium leading-tight">
                            {sub.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {sub.course.name}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sub.isActive ? "soft" : "secondary"}>
                          {sub.isActive ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {sub.dueDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {sub._count?.entries ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {sub.totalPoints}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <TutorSubmissionActions
                            submissionId={sub.id}
                            submissionTitle={sub.title}
                            courseId={sub.course.id}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
