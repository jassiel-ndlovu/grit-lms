/**
 * /dashboard/submissions/[id] — single assignment detail.
 *
 * Server Component. Behaviour branches on session role:
 *   - Student → assignment description + uploads + their entry status. The
 *     submission form is a client island that uploads files to Blob and
 *     calls submitEntry.
 *   - Tutor   → assignment description + summary of student entries with a
 *     link out to the per-student grading view.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  GraduationCap,
  Hourglass,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getEntryByStudentAndSubmission,
  getSubmissionDetailById,
  listEntriesForSubmission,
} from "@/features/submissions/queries";
import { SubmissionForm } from "@/features/submissions/components/submission-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Submission" };

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");

  const submission = await getSubmissionDetailById(id);
  if (!submission) notFound();

  /* ---------------------------- Student branch ---------------------------- */
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

    // Enrolment gate.
    const enrolled = await prisma.course.findFirst({
      where: {
        id: submission.courseId,
        students: { some: { id: student.id } },
      },
      select: { id: true },
    });
    if (!enrolled) {
      return (
        <div className="text-muted-foreground p-8 text-sm">
          You aren&apos;t enrolled in this course.
        </div>
      );
    }

    const entry = await getEntryByStudentAndSubmission(student.id, submission.id);
    const graded = entry?.status === "GRADED";
    const grade = entry?.grade ?? null;

    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/courses/${submission.courseId}`}>
            ← Back to course
          </Link>
        </Button>

        <header className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {submission.course.name} · with {submission.course.tutor.fullName}
          </p>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {submission.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Due {dateFmt.format(submission.dueDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hourglass className="size-4" />
              {submission.totalPoints} points
            </span>
            {submission.maxAttempts && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" />
                {submission.maxAttempts} attempts allowed
              </span>
            )}
          </div>
        </header>

        {submission.description && (
          <Card className="space-y-3 p-6">
            <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
              <FileText className="text-brand-terracotta size-4" />
              Brief
            </h2>
            <p className="text-foreground whitespace-pre-wrap text-sm">
              {submission.description}
            </p>
            {submission.descriptionFiles &&
              submission.descriptionFiles.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {submission.descriptionFiles.map((url) => (
                    <li key={url}>
                      <Link
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-terracotta inline-flex items-center gap-1 hover:underline"
                      >
                        Resource
                        <ExternalLink className="size-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        )}

        <Card className="space-y-4 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Your submission
            </h2>
            {entry && (
              <Badge
                variant={
                  graded
                    ? "brand"
                    : entry.status === "SUBMITTED"
                      ? "soft"
                      : "secondary"
                }
              >
                {graded
                  ? "Graded"
                  : entry.status === "SUBMITTED"
                    ? "Awaiting grade"
                    : entry.status === "LATE"
                      ? "Late"
                      : "In progress"}
              </Badge>
            )}
          </div>

          {graded && grade && (
            <div className="bg-brand-terracotta/8 border-brand-terracotta/30 flex items-center justify-between rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="bg-brand-terracotta/15 text-brand-terracotta flex size-10 items-center justify-center rounded-md">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <p className="font-display text-2xl tabular-nums text-foreground">
                    {grade.score}
                    <span className="text-muted-foreground">
                      {" "}
                      / {grade.outOf}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {grade.outOf > 0
                      ? `${Math.round((grade.score / grade.outOf) * 100)}%`
                      : ""}
                  </p>
                </div>
              </div>
              {entry.feedback && (
                <p className="text-muted-foreground max-w-md text-right text-sm italic">
                  &ldquo;{entry.feedback}&rdquo;
                </p>
              )}
            </div>
          )}

          <Separator />

          <SubmissionForm
            submissionId={submission.id}
            initialFileUrls={entry?.fileUrl ?? []}
            disabled={graded}
          />
        </Card>
      </div>
    );
  }

  /* ---------------------------- Tutor branch ----------------------------- */
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

    if (submission.course.tutor.email !== session.user.email) {
      return (
        <div className="text-muted-foreground p-8 text-sm">
          You don&apos;t own this assignment.
        </div>
      );
    }

    const entries = await listEntriesForSubmission(submission.id);

    return (
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/manage-courses/${submission.courseId}`}>
            ← Back to course
          </Link>
        </Button>

        <header className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {submission.course.name}
          </p>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {submission.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Due {dateFmt.format(submission.dueDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hourglass className="size-4" />
              {submission.totalPoints} points
            </span>
          </div>
        </header>

        <Card className="overflow-hidden p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 py-4">
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Student submissions
            </h2>
            <span className="text-muted-foreground text-xs">
              {entries.length}{" "}
              {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <Separator />
          {entries.length === 0 ? (
            <div className="text-muted-foreground p-12 text-center text-sm">
              No submissions yet.
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {e.student.fullName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {e.fileUrl.length}{" "}
                      {e.fileUrl.length === 1 ? "file" : "files"} · attempt{" "}
                      {e.attemptNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={
                        e.status === "GRADED"
                          ? "brand"
                          : e.status === "SUBMITTED"
                            ? "soft"
                            : "secondary"
                      }
                    >
                      {e.status === "GRADED"
                        ? "Graded"
                        : e.status === "SUBMITTED"
                          ? "Awaiting grade"
                          : e.status === "LATE"
                            ? "Late"
                            : "In progress"}
                    </Badge>
                    {e.grade && (
                      <span className="font-display tabular-nums text-foreground text-sm">
                        {e.grade.score}
                        <span className="text-muted-foreground">
                          {" "}
                          / {e.grade.outOf}
                        </span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  return null;
}
