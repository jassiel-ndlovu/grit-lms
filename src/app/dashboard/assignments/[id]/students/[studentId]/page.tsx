/**
 * /dashboard/assignments/[id]/students/[studentId] — tutor grades a single
 * student's submission entry.
 *
 * Server Component. Loads the entry + any existing QuestionGrade rows
 * (which we use as "sections") and hands them to the client-side
 * EntryGradingForm.
 *
 * The tutor can either (a) drop a single total mark, or (b) break the
 * entry into sections with per-section score, remarks, and an optional
 * memo file.
 *
 * Entry point: the student list on /dashboard/assignments/[id]. Back links
 * return there.
 */

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Download, Eye, FileText, Mail } from "lucide-react";

import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getEntryByStudentAndSubmission,
  getSubmissionDetailById,
  submissionBelongsToTutor,
} from "@/features/assignments/queries";
import {
  parseSectionFeedback,
  sectionOrdinal,
} from "@/features/assignments/lib/sections";
import { EntryGradingForm } from "@/features/assignments/components/entry-grading-form";
import { MemoFilesEditor } from "@/features/assignments/components/memo-files-editor";
import { DeleteEntryButton } from "@/features/assignments/components/delete-entry-button";
import { assignmentRoutes } from "@/features/assignments/routes";
import { getCourseScope } from "@/features/courses/course-access";
import { schoolDateFormat } from "@/lib/datetime";

interface PageProps {
  params: Promise<{ id: string; studentId: string }>;
}

const dateFmt = schoolDateFormat({
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fileNameFromUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url.split("?")[0]);
    return decoded.split("/").pop() ?? url;
  } catch {
    return url;
  }
}

export const metadata = { title: "Grade submission" };

export default async function StudentGradingPage({ params }: PageProps) {
  const { id: submissionId, studentId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const scope = await getCourseScope(session.user.id);

  const owns = await submissionBelongsToTutor(submissionId, scope);
  if (!owns) {
    return (
      <PageMessage breadcrumb={[{ label: "Assignments", href: assignmentRoutes.index }, { label: "Entry" }]}>
        You don&apos;t own this assignment.
      </PageMessage>
    );
  }

  const [submission, entry] = await Promise.all([
    getSubmissionDetailById(submissionId),
    getEntryByStudentAndSubmission(studentId, submissionId),
  ]);
  if (!submission) notFound();
  if (!entry) {
    return (
      <PageFrame
        type="record"
        breadcrumb={[
          { label: "Assignments", href: assignmentRoutes.index },
          { label: submission.title, href: assignmentRoutes.detail(submissionId) },
          { label: "Entry" },
        ]}
      >
        <PageTitle eyebrow={submission.course.name} title={submission.title} />
        <Card className="p-8 text-center">
          <FileText className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 text-sm text-muted-foreground">
            This student hasn&apos;t submitted this assignment yet.
          </p>
        </Card>
      </PageFrame>
    );
  }

  const grade = entry.grade;
  const submissionTotal = submission.totalPoints ?? 1;

  // Rehydrate any previously-stored sections into the form's shape.
  const storedSections = [...entry.questionGrades]
    .sort(
      (a, b) => sectionOrdinal(a.questionId) - sectionOrdinal(b.questionId),
    )
    .map((qg) => {
      const parsed = parseSectionFeedback(qg.feedback);
      return {
        title: parsed?.title ?? "Section",
        remarks: parsed?.remarks ?? "",
        score: qg.score ?? 0,
        outOf: qg.outOf ?? 0,
        memoFileUrl: parsed?.memoFileUrl ?? null,
      };
    });

  const defaultScore = grade?.score ?? 0;
  const defaultOutOf = grade?.outOf ?? submissionTotal;
  const defaultFeedback = grade?.finalComments ?? entry.feedback ?? "";

  return (
    <PageFrame
      type="record"
      breadcrumb={[
        { label: "Assignments", href: assignmentRoutes.index },
        { label: submission.title, href: assignmentRoutes.detail(submissionId) },
        { label: entry.student.fullName },
      ]}
      status={<StatusChip tone={entry.status === "GRADED" ? "success" : "info"}>{entry.status.replace("_", " ")}</StatusChip>}
      actions={<DeleteEntryButton entryId={entry.id} submissionId={submissionId} studentName={entry.student.fullName} />}
    >
      <PageTitle
        eyebrow={`${submission.course.name} · ${submission.title}`}
        title={entry.student.fullName}
        properties={
          <PropertyList>
            <PropertyRow label="Due">{dateFmt.format(submission.dueDate)}</PropertyRow>
            <PropertyRow label="Points">{submission.totalPoints}</PropertyRow>
          </PropertyList>
        }
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg leading-tight">
                Submitted files
              </h2>
              <Badge variant="secondary">
                Attempt #{entry.attemptNumber}
              </Badge>
            </div>
            <Separator className="mb-4" />
            {entry.fileUrl.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No files uploaded with this submission.
              </p>
            ) : (
              <ul className="space-y-2">
                {entry.fileUrl.map((file) => (
                  <li
                    key={file}
                    className="bg-muted/30 flex items-center justify-between gap-3 rounded-md p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate text-sm">
                        {fileNameFromUrl(file)}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={file} target="_blank" rel="noreferrer">
                          <Eye className="mr-1 size-3.5" /> View
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={file} download target="_blank" rel="noreferrer">
                          <Download className="mr-1 size-3.5" /> Download
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <EntryGradingForm
            entryId={entry.id}
            submissionId={submission.id}
            studentName={entry.student.fullName}
            totalPointsDefault={submissionTotal}
            defaultValues={{
              score: defaultScore,
              outOf: defaultOutOf,
              feedback: defaultFeedback,
              sections: storedSections,
            }}
          />
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-sm leading-tight text-muted-foreground uppercase tracking-wide">
              Student
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="bg-brand-terracotta text-brand-terracotta-foreground flex size-10 items-center justify-center rounded-full text-sm font-semibold">
                {entry.student.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.student.fullName}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {entry.student.email}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={`mailto:${entry.student.email}`}>
                <Mail className="mr-2 size-4" /> Email student
              </a>
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-sm leading-tight text-muted-foreground uppercase tracking-wide">
              Timeline
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-foreground">
                  {dateFmt.format(entry.submittedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attempt</span>
                <span className="text-foreground tabular-nums">
                  #{entry.attemptNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={entry.status === "GRADED" ? "brand" : "secondary"}
                >
                  {entry.status.replace("_", " ")}
                </Badge>
              </div>
              {grade && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground text-xs">
                      Current grade
                    </span>
                    <span className="font-display tabular-nums text-foreground">
                      {grade.score}
                      <span className="text-muted-foreground">
                        {" "}
                        / {grade.outOf}
                      </span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-brand-terracotta size-4" />
              <h3 className="font-display text-sm leading-tight">
                Assignment memo
              </h3>
            </div>
            <p className="text-muted-foreground mt-1 mb-3 text-xs">
              Model answers / solution notes. Visible to every student who
              has submitted this assignment.
            </p>
            <MemoFilesEditor
              submissionId={submission.id}
              initialUrls={submission.memoFileUrls ?? []}
            />
          </Card>
        </aside>
      </section>
    </PageFrame>
  );
}
