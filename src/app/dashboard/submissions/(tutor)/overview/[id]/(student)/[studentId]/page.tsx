/**
 * /dashboard/submissions/overview/[id]/[studentId] — tutor grades a single
 * student's submission entry.
 *
 * Server Component. Loads the entry + any existing QuestionGrade rows
 * (which we use as "sections") and hands them to the client-side
 * EntryGradingForm.
 *
 * The tutor can either (a) drop a single total mark, or (b) break the
 * entry into sections with per-section score, remarks, and an optional
 * memo file.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Download, Eye, FileText, Mail } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getEntryByStudentAndSubmission,
  getSubmissionDetailById,
  submissionBelongsToTutor,
} from "@/features/submissions/queries";
import {
  parseSectionFeedback,
  sectionOrdinal,
} from "@/features/submissions/lib/sections";
import { EntryGradingForm } from "@/features/submissions/components/entry-grading-form";
import { MemoFilesEditor } from "@/features/submissions/components/memo-files-editor";

interface PageProps {
  params: Promise<{ id: string; studentId: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
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

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true, fullName: true },
  });
  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const owns = await submissionBelongsToTutor(submissionId, tutor.id);
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this assignment.
      </div>
    );
  }

  const [submission, entry] = await Promise.all([
    getSubmissionDetailById(submissionId),
    getEntryByStudentAndSubmission(studentId, submissionId),
  ]);
  if (!submission) notFound();
  if (!entry) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/submissions/overview/${submissionId}`}>
            ← Back to overview
          </Link>
        </Button>
        <Card className="p-8 text-center">
          <FileText className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 text-sm text-muted-foreground">
            This student hasn&apos;t submitted this assignment yet.
          </p>
        </Card>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/submissions/overview/${submissionId}`}>
            ← Back to overview
          </Link>
        </Button>
      </div>

      <header className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-primary-foreground/70 text-xs">
              {submission.course.name}
            </p>
            <h1 className="font-display mt-1 text-2xl leading-tight tracking-tight">
              {submission.title}
            </h1>
            <p className="text-primary-foreground/80 mt-2 text-sm">
              Grading <span className="font-medium">{entry.student.fullName}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Due
              </p>
              <p>{dateFmt.format(submission.dueDate)}</p>
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Points
              </p>
              <p>{submission.totalPoints}</p>
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Status
              </p>
              <p>{entry.status.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </header>

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
    </div>
  );
}
