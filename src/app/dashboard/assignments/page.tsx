/**
 * /dashboard/assignments — student catalogue of assignments across enrolled
 * courses. Tutors land here too but see their own assignments-by-course view.
 *
 * Server Component. Replaces the legacy student-submissions / tutor-submissions
 * client components in one role-branched RSC page.
 */

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { redirect } from "next/navigation";
import { parentLanding } from "@/features/activity/lib/child-overview";
import { getViewer } from "@/lib/viewer";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getEntryByStudentAndSubmission,
  listActiveSubmissionsForStudent,
  listSubmissionsByTutorId,
} from "@/features/assignments/queries";
import { SubmissionCard } from "@/features/assignments/components/submission-card";
import { SubmissionGrid } from "@/features/assignments/components/submission-grid";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TutorSubmissionActions } from "@/features/assignments/components/tutor-submission-actions";
import { TestsTabs } from "@/features/assessments/components/tests-tabs";
import {
  bucketCounts,
  filterByBucket,
  type FilterBucket,
} from "@/features/assessments/lib/filters";
import { assignmentRoutes } from "@/features/assignments/routes";
import { entryMarkReleased } from "@/features/grades/lib/release";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import HeaderAssignments from "@/components/illustrations/generated/header-assignments";
import { WriteGuard } from "@/components/shell/workspace-access";
import { getCourseScope } from "@/features/courses/course-access";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from "@/lib/datetime";

export const metadata = { title: "Assignments" };

export default async function SubmissionsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  // Parents have no student pages; send them to their child (F7).
  if (session.user.role === "PARENT") redirect(parentLanding((await getViewer())?.children ?? []));

  if (session.user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!student) {
      return (
        <PageMessage breadcrumb={[{ label: "Assignments" }]}>
          This page is for students, and this account isn&apos;t set up as one. If you&apos;re a student, ask your tutor or school to check it.
        </PageMessage>
      );
    }

    const subs = await listActiveSubmissionsForStudent(student.id);
    const entries = await Promise.all(
      subs.map((s) => getEntryByStudentAndSubmission(student.id, s.id)),
    );

    const rows = subs.map((sub, i) => ({
      sub,
      entry: entries[i],
      dueDate: sub.dueDate,
      status: entries[i]?.status ?? "NOT_STARTED",
    }));

    const counts = bucketCounts(rows);

    function renderBucket(b: FilterBucket) {
      const filtered = filterByBucket(rows, b).sort(
        (x, y) => x.sub.dueDate.getTime() - y.sub.dueDate.getTime(),
      );
      return (
        <SubmissionGrid
          isEmpty={filtered.length === 0}
          empty={
            <EmptyState
              className="border-input rounded-lg border border-dashed"
              illustration={<Scene name="empty-submissions" />}
              title={
                b === "upcoming"
                  ? "No assignments to hand in right now"
                  : b === "missed"
                    ? "You haven't missed any assignments"
                    : b === "submitted"
                      ? "Nothing waiting to be marked"
                      : b === "graded"
                        ? "No marked assignments yet"
                        : "No assignments yet"
              }
              description={
                b === "upcoming"
                  ? "When a tutor sets an assignment on one of your courses, it shows here with its due date."
                  : b === "submitted"
                    ? "Work you hand in shows here until your tutor marks it."
                    : b === "graded"
                      ? "Your marks and your tutor's comments show here after your work is marked."
                      : b === "all"
                        ? "Assignments your tutors set show here."
                        : undefined
              }
            />
          }
        >
          {filtered.map(({ sub: s, entry }) => (
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
                      grade: entry.grade && entryMarkReleased(entry.status)
                        ? {
                            score: entry.grade.score,
                            outOf: entry.grade.outOf,
                          }
                        : null,
                    }
                  : null
              }
              href={assignmentRoutes.detail(s.id)}
            />
          ))}
        </SubmissionGrid>
      );
    }

    return (
      <PageFrame type="list" breadcrumb={[{ label: "Assignments" }]}>
        <PageTitle
          eyebrow="Coursework"
          title="Assignments"
          description="Work your tutors have set. Open one to read it and hand in your files."
          illustration={<HeaderAssignments />}
        />

        <TestsTabs
          counts={counts}
          panels={{
            all: renderBucket("all"),
            upcoming: renderBucket("upcoming"),
            missed: renderBucket("missed"),
            submitted: renderBucket("submitted"),
            graded: renderBucket("graded"),
          }}
        />
      </PageFrame>
    );
  }

  if (session.user.role === "TUTOR") {
    const scope = await getCourseScope(session.user.id);

    const subs = await listSubmissionsByTutorId(scope);

    // Sort active-first, newest due first — mirrors the tutor tests table.
    const rows = [...subs].sort((a, b) => {
      if (Boolean(a.isActive) !== Boolean(b.isActive)) return a.isActive ? -1 : 1;
      return b.dueDate.getTime() - a.dueDate.getTime();
    });

    return (
      <PageFrame
        type="list"
        breadcrumb={[{ label: "Assignments" }]}
        actions={
          <WriteGuard label="New assignment" variant="brand">
            <Button asChild variant="brand" size="sm">
              <Link href={assignmentRoutes.new}>
                <Plus className="size-4" /> New assignment
              </Link>
            </Button>
          </WriteGuard>
        }
      >
        <PageTitle title="Assignments" description="Work you've set for your courses, latest due date first. Open one to see and mark what students handed in." />

        {rows.length === 0 ? (
          <EmptyState
            className="border-input rounded-lg border border-dashed"
            illustration={<Scene name="empty-submissions" />}
            title="No assignments yet"
            description="Choose New assignment to set one. Students see it once it's published."
          />
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
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="w-[40%] px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Due</th>
                    <th className="px-4 py-2 text-right font-medium">Handed in</th>
                    <th className="px-4 py-2 text-right font-medium">Marks</th>
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
                          href={assignmentRoutes.detail(sub.id)}
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
                          {sub.dueDate.toLocaleDateString(DEFAULT_LOCALE, {
                            timeZone: DEFAULT_TIME_ZONE,
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
      </PageFrame>
    );
  }

  return null;
}
