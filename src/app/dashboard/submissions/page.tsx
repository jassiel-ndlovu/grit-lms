/**
 * /dashboard/submissions — student catalogue of assignments across enrolled
 * courses. Tutors land here too but see their own assignments-by-course view.
 *
 * Server Component. Replaces the legacy student-submissions / tutor-submissions
 * client components in one role-branched RSC page.
 */

import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getEntryByStudentAndSubmission,
  listActiveSubmissionsForStudent,
  listSubmissionsByTutorId,
} from "@/features/submissions/queries";
import { SubmissionCard } from "@/features/submissions/components/submission-card";
import { SubmissionGrid } from "@/features/submissions/components/submission-grid";

export const metadata = { title: "Submissions" };

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
          {subs.map((s, i) => {
            const entry = entries[i];
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

    return (
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            Assignments
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Every assignment you&apos;ve published, newest due-date first.
          </p>
        </header>

        <SubmissionGrid
          isEmpty={subs.length === 0}
          empty={
            <div className="border-input rounded-lg border border-dashed p-12 text-center">
              <Pencil className="text-muted-foreground mx-auto size-10" />
              <h3 className="font-display mt-3 text-lg text-foreground">
                No assignments yet
              </h3>
              <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
                Create one from a course&apos;s manage page.
              </p>
            </div>
          }
        >
          {subs.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              href={`/dashboard/submissions/${s.id}`}
            />
          ))}
        </SubmissionGrid>
      </div>
    );
  }

  return null;
}
