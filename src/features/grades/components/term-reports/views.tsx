/**
 * Term report screens' parts (server-safe): the terms, a term's courses and
 * students, a course's students with their comment boxes, one student's
 * report, and the list families download from. Samples on
 * /design-system/term-reports.
 */

import Link from "next/link";
import { ChevronRight, FileDown, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, type DateContext } from "@/lib/datetime";

import { attendanceText, commentsText, percentText, reportRoutes, type TermPhase } from "../../lib/term-report";
import type { FamilyReport, LearnerReport, ReportComment, ReportCourse, TermCourseRow, TermStudentRow } from "../../term-reports";
import { CommentBox } from "./comment-box";

/** "21 Jul 2026 to 2 Oct 2026": days, so they're never shifted by a time zone. */
export function termDays(startsOn: string, endsOn: string, locale?: DateContext["locale"]) {
  const day = (d: string) => formatDate(`${d}T00:00:00Z`, { timeZone: "UTC", locale }, { day: "numeric", month: "short", year: "numeric" });
  return `${day(startsOn)} to ${day(endsOn)}`;
}

export const PHASE_LABEL: Record<TermPhase, string> = { upcoming: "Not started", running: "Running", ended: "Ended" };

/** "Released", or where the term is. */
export function TermStatus({ released, phase }: { released: boolean; phase: TermPhase }) {
  return <Badge variant={released ? "soft" : "secondary"}>{released ? "Released" : PHASE_LABEL[phase]}</Badge>;
}

export interface TermListItem {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  released: boolean;
  phase: TermPhase;
}

export function TermList({ terms, locale }: { terms: TermListItem[]; locale?: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-border divide-y">
        {terms.map((t) => (
          <li key={t.id}>
            <Link href={reportRoutes.term(t.id)} className="hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{t.title}</p>
                <p className="text-muted-foreground text-xs">{termDays(t.startsOn, t.endsOn, locale)}</p>
              </div>
              <TermStatus released={t.released} phase={t.phase} />
              <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TermCourses({ termId, courses }: { termId: string; courses: TermCourseRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-border divide-y">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={reportRoutes.course(termId, c.id)} className="hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5">
              <MessageSquareText aria-hidden className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{c.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.tutorName ? `${c.tutorName} · ` : ""}
                  {commentsText(c.written, c.students)}
                </p>
              </div>
              <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TermStudents({ termId, students }: { termId: string; students: TermStudentRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-border divide-y">
        {students.map((s) => (
          <li key={s.learnerId}>
            <Link href={reportRoutes.student(termId, s.learnerId)} className="hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{s.name}</p>
                <p className="text-muted-foreground truncate text-xs">{s.courses.join(" · ")}</p>
              </div>
              <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Figures({ course }: { course: ReportCourse }) {
  const attended = attendanceText(course.attendance);
  return (
    <p className="text-muted-foreground text-sm">
      <span className={course.percent === null ? undefined : "text-foreground font-medium tabular-nums"}>{percentText(course.percent)}</span>
      {course.symbol ? ` · ${course.symbol}` : ""}
      {attended ? ` · ${attended}` : ""}
    </p>
  );
}

/** Every student on a course, each with their figures and a comment box. */
export function CourseComments({ termId, courseId, reports, canEdit }: { termId: string; courseId: string; reports: LearnerReport[]; canEdit: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-border divide-y">
        {reports.map((r) => {
          const course = r.courses.find((c) => c.courseId === courseId);
          if (!course) return null;
          return (
            <li key={r.learnerId} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
              <div className="min-w-0 space-y-1">
                <Link href={reportRoutes.student(termId, r.learnerId)} className="text-foreground text-sm font-medium underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <Figures course={course} />
              </div>
              {canEdit ? (
                <CommentBox
                  target={{ termId, learnerId: r.learnerId, courseId }}
                  initial={course.comment?.text ?? ""}
                  label={`Comment for ${r.name}`}
                  placeholder="What went well, and what to work on"
                />
              ) : (
                <p className="text-muted-foreground text-sm whitespace-pre-line">{course.comment?.text ?? "No comment yet"}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** One course of a student's report, as the PDF shows it. */
function CourseBlock({ course }: { course: ReportCourse }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold">{course.name}</h3>
          {course.tutorName ? <p className="text-muted-foreground text-xs">{course.tutorName}</p> : null}
        </div>
        <p className="text-foreground text-sm font-semibold tabular-nums">
          {percentText(course.percent)}
          {course.symbol ? <span className="text-muted-foreground font-normal"> · {course.symbol}</span> : null}
        </p>
      </div>
      {course.items.length ? (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 sm:pl-5">Assessment</TableHead>
                <TableHead className="text-right">Mark</TableHead>
                <TableHead className="pr-4 text-right sm:pr-5">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="pl-4 whitespace-normal sm:pl-5">
                    {i.title} <span className="text-muted-foreground">({i.kind})</span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{i.score === null ? "–" : `${Math.round(i.score * 10) / 10} / ${i.outOf}`}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums sm:pr-5">{i.score === null || i.outOf <= 0 ? "–" : `${Math.round((i.score / i.outOf) * 1000) / 10}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <div className="space-y-2 border-t px-4 py-3 text-sm sm:px-5">
        {course.attendance ? <p className="text-muted-foreground">Attendance: {attendanceText(course.attendance)}</p> : null}
        {course.comment ? (
          <div>
            <p className="text-foreground whitespace-pre-line">{course.comment.text}</p>
            {course.comment.by ? <p className="text-muted-foreground mt-1 text-xs">{course.comment.by}</p> : null}
          </div>
        ) : (
          <p className="text-muted-foreground">No comment yet</p>
        )}
      </div>
    </Card>
  );
}

export function StudentReportBody({ termId, report, overall, complete, canEditOverall }: {
  termId: string;
  report: LearnerReport;
  overall: ReportComment | null;
  complete: boolean;
  canEditOverall: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {report.courses.map((c) => (
          <CourseBlock key={c.courseId} course={c} />
        ))}
      </div>
      {complete ? (
        <section className="space-y-3" aria-labelledby="general-comment">
          <h2 id="general-comment" className="text-foreground text-base font-semibold">
            General comment
          </h2>
          {canEditOverall ? (
            <CommentBox
              target={{ termId, learnerId: report.learnerId, courseId: null }}
              initial={overall?.text ?? ""}
              label={`General comment for ${report.name}`}
              placeholder="Shown at the end of the report, with your name"
            />
          ) : (
            <p className="text-muted-foreground text-sm whitespace-pre-line">{overall?.text ?? "No comment yet"}</p>
          )}
        </section>
      ) : (
        <p role="note" className="text-muted-foreground text-sm">
          This student also takes courses you don&apos;t teach. The full report is downloaded by someone who can see all of them.
        </p>
      )}
    </div>
  );
}

/** A download: a plain link, so it works without JavaScript and isn't prefetched. */
export function DownloadReport({ termId, learnerId, label = "Download PDF", variant = "default" }: { termId: string; learnerId: string; label?: string; variant?: "default" | "outline" }) {
  return (
    <Button asChild size="sm" variant={variant}>
      <a href={reportRoutes.pdf(termId, learnerId)}>
        <FileDown aria-hidden className="size-4" />
        {label}
      </a>
    </Button>
  );
}

/** Released reports, for a parent or an adult student. */
export function FamilyReports({ reports, locale }: { reports: FamilyReport[]; locale?: string }) {
  if (reports.length === 0) return null;
  return (
    <section className="space-y-4" aria-labelledby="term-reports">
      <h2 id="term-reports" className="text-foreground text-base font-semibold">
        Term reports
      </h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-border divide-y">
          {reports.map((r) => (
            <li key={`${r.termId}:${r.learnerId}`} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-foreground truncate text-sm font-medium">{r.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {r.workspaceName} · {termDays(r.startsOn, r.endsOn, locale)}
                </p>
              </div>
              <DownloadReport termId={r.termId} learnerId={r.learnerId} variant="outline" />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
