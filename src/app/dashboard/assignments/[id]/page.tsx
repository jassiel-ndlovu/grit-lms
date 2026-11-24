/**
 * /dashboard/assignments/[id] — single assignment detail.
 *
 * Server Component. Behaviour branches on session role:
 *   - Student → assignment description + uploads + their entry status. The
 *     submission form is a client island that uploads files to Blob and
 *     calls submitEntry.
 *   - Tutor   → assignment description + summary of student entries with a
 *     link out to the per-student grading view.
 */

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  FileText,
  GraduationCap,
  Hourglass,
  Paperclip,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enrolledStudent, tutorOf } from "@/features/courses/lib/tenancy-where";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getEntryByStudentAndSubmission,
  getSubmissionDetailById,
  listEntriesForSubmission,
} from "@/features/assignments/queries";
import { SubmissionForm } from "@/features/assignments/components/submission-form";
import { RichContent } from "@/components/content/rich-content";
import {
  parseSectionFeedback,
  sectionOrdinal,
} from "@/features/assignments/lib/sections";
import { assignmentRoutes } from "@/features/assignments/routes";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { getCourseScope } from "@/features/courses/course-access";
import { manageableBy } from "@/features/courses/lib/course-access";
import { schoolDateFormat } from "@/lib/datetime";
import { TonePanel } from "@/components/ui/nexus";

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("?")[0]).split("/").pop() ?? url;
  } catch {
    return url;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = schoolDateFormat({
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Assignment" };

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
        <PageMessage breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: "Assignment" }]}>
          This page is for students, and this account isn&apos;t set up as one. If you&apos;re a student, ask your tutor or school to check it.
        </PageMessage>
      );
    }

    // Enrolment gate.
    const enrolled = await prisma.course.findFirst({
      where: {
        id: submission.courseId,
        ...enrolledStudent(student.id),
      },
      select: { id: true },
    });
    if (!enrolled) {
      return (
        <PageMessage breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: "Assignment" }]}>
          You&apos;re not on this course. Ask your tutor to add you.
        </PageMessage>
      );
    }

    const entry = await getEntryByStudentAndSubmission(student.id, submission.id);
    const graded = entry?.status === "GRADED";
    const grade = entry?.grade ?? null;

    return (
      <PageFrame type="settings" breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: submission.title }]}>
        <PageTitle
          eyebrow={<>{submission.course.name} · with {tutorOf(submission.course)?.fullName ?? "your tutor"}</>}
          title={submission.title}
          properties={
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" />
                Due {dateFmt.format(submission.dueDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hourglass className="size-4" />
                {submission.totalPoints} marks
              </span>
              {submission.maxAttempts && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" />
                  {submission.maxAttempts} attempts allowed
                </span>
              )}
            </div>
          }
        />

        {submission.description && (
          <Card className="space-y-3 p-6">
            <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
              <FileText className="text-brand-terracotta size-4" />
              What to do
            </h2>
            {/* The rich document when there is one, else the markdown
                (contracts/editor.md); both render maths. */}
            <div className="text-sm">
              <RichContent value={submission.descriptionJson} markdown={submission.description} />
            </div>
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
                        <Paperclip className="size-3" />
                        {fileNameFromUrl(url)}
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
              Your work
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
                  ? "Marked"
                  : entry.status === "SUBMITTED"
                    ? "Waiting to be marked"
                    : entry.status === "LATE"
                      ? "Handed in late"
                      : "In progress"}
              </Badge>
            )}
          </div>

          {graded && grade && (
            <TonePanel tone="accent" className="flex flex-wrap items-center justify-between gap-3">
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
              {grade.finalComments && (
                <div className="max-w-md text-right text-sm">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Your tutor&apos;s comment
                  </p>
                  <p className="text-foreground mt-1">{grade.finalComments}</p>
                </div>
              )}
            </TonePanel>
          )}

          <Separator />

          <SubmissionForm
            submissionId={submission.id}
            initialFileUrls={entry?.fileUrl ?? []}
            disabled={graded}
          />
        </Card>

        {/* Per-section breakdown — only shown when the tutor chose to grade
            section-by-section AND the entry is graded. */}
        {graded &&
          entry?.questionGrades &&
          entry.questionGrades.length > 0 && (
            <Card className="p-6">
              <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
                <BookOpen className="text-brand-terracotta size-4" />
                Marks for each section
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Your tutor marked this in sections. Open a section&apos;s memo to see its model answer.
              </p>
              <Separator className="my-4" />
              <ul className="space-y-4">
                {[...entry.questionGrades]
                  .sort(
                    (a, b) =>
                      sectionOrdinal(a.questionId) -
                      sectionOrdinal(b.questionId),
                  )
                  .map((qg, idx) => {
                    const parsed = parseSectionFeedback(qg.feedback);
                    const title = parsed?.title ?? `Section ${idx + 1}`;
                    const remarks = parsed?.remarks ?? qg.feedback ?? "";
                    const pct =
                      qg.outOf > 0
                        ? Math.round((qg.score / qg.outOf) * 100)
                        : null;
                    const good = pct != null && pct >= 50;
                    return (
                      <li
                        key={qg.id}
                        className={`border-l-4 ${good ? "border-emerald-500" : "border-destructive"} bg-muted/30 rounded-md p-4`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <h3 className="font-medium text-foreground">
                            {title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {pct != null && (
                              <Badge
                                variant={good ? "brand" : "secondary"}
                                className="tabular-nums"
                              >
                                {pct}%
                              </Badge>
                            )}
                            <span className="font-display tabular-nums text-foreground text-sm">
                              {qg.score}
                              <span className="text-muted-foreground">
                                {" "}
                                / {qg.outOf}
                              </span>
                            </span>
                          </div>
                        </div>
                        {remarks && (
                          <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                            {remarks}
                          </p>
                        )}
                        {parsed?.memoFileUrl && (
                          <div className="mt-3">
                            <a
                              href={parsed.memoFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-terracotta inline-flex items-center gap-1 text-xs hover:underline"
                            >
                              <Paperclip className="size-3" />
                              Memo for this section
                            </a>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}

        {/* Assignment-wide memo files — visible to students only once the
            tutor has released them (may be empty until then). */}
        {graded &&
          submission.memoFileUrls &&
          submission.memoFileUrls.length > 0 && (
            <Card className="p-6">
              <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
                <Paperclip className="text-brand-terracotta size-4" />
                Memo and model answers
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Your tutor&apos;s worked solutions for this assignment.
              </p>
              <Separator className="my-4" />
              <ul className="space-y-1 text-sm">
                {submission.memoFileUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-terracotta inline-flex items-center gap-1 hover:underline"
                    >
                      <FileText className="size-3" />
                      {fileNameFromUrl(url)}
                      <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
      </PageFrame>
    );
  }

  /* ---------------------------- Tutor branch ----------------------------- */
  if (session.user.role === "TUTOR") {
    const scope = await getCourseScope(session.user.id);

    const teaches = await prisma.course.count({ where: { id: submission.courseId, ...manageableBy(scope) } });
    if (teaches === 0) {
      return (
        <PageMessage breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: "Assignment" }]}>
          Only staff who teach or manage this assignment&apos;s course can open this page.
        </PageMessage>
      );
    }

    const entries = await listEntriesForSubmission(submission.id);

    return (
      <PageFrame type="record" breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: submission.title }]}>
        <PageTitle
          eyebrow={submission.course.name}
          title={submission.title}
          properties={
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" />
                Due {dateFmt.format(submission.dueDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hourglass className="size-4" />
                {submission.totalPoints} marks
              </span>
            </div>
          }
        />

        <Card className="overflow-hidden p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 py-4">
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Students&apos; work
            </h2>
            <span className="text-muted-foreground text-xs">
              {entries.length}{" "}
              handed in
            </span>
          </div>
          <Separator />
          {entries.length === 0 ? (
            <EmptyState
              compact
              illustration={<Scene name="nothing-to-grade" />}
              title="Nothing handed in yet"
              description="Each student's work shows here when they hand it in, ready to mark."
            />
          ) : (
            <ul className="divide-border divide-y">
              {entries.map((e) => {
                // Each row links to the per-student grading page. Wrapping the
                // whole <li> content in a Link makes the row keyboard-focusable
                // and gives the tutor a natural "click the student to grade
                // them" affordance.
                const href = assignmentRoutes.student(submission.id, e.studentId);
                return (
                  <li key={e.id}>
                    <Link
                      href={href}
                      className="hover:bg-muted/40 focus-visible:bg-muted/40 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors"
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
                            ? "Marked"
                            : e.status === "SUBMITTED"
                              ? "Waiting to be marked"
                              : e.status === "LATE"
                                ? "Handed in late"
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
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageFrame>
    );
  }

  return null;
}
