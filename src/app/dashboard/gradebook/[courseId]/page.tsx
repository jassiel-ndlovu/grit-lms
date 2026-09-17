/**
 * /dashboard/gradebook/[courseId] — the class view.
 *
 * Three stacked panels:
 *   1. Class summary — mean/median/spread of the weighted mark, plus a
 *      distribution across 10-point bands.
 *   2. Weights editor — a client island that writes Test.weight /
 *      Submission.weight.
 *   3. The grid — one row per student, one column per assessment, with the
 *      weighted mark on the right.
 *
 * Every mark shown here is the weighted one. `markToDate` renormalises over
 * whatever has actually been graded, so a class two weeks into term reads
 * correctly instead of looking like everybody is failing; the "of course"
 * column is the running total against the full year and the coverage
 * figure says how much of it is in.
 *
 * Server Component, tutor-only.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  courseBelongsToTutor,
  getCourseGradebook,
} from "@/features/grades/gradebook";
import {
  assessmentAverage,
  buildWeightPlan,
  computeStudentMark,
  summariseClass,
} from "@/features/grades/lib/weighting";
import { WeightsEditor } from "@/features/grades/components/weights-editor";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export const metadata = { title: "Gradebook" };

function markTone(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 50) return "text-foreground";
  return "text-destructive";
}

function fmt(v: number | null, suffix = "%"): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}${suffix}`;
}

export default async function CourseGradebookPage({ params }: PageProps) {
  const { courseId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard/grades");

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

  const owns = await courseBelongsToTutor(courseId, tutor.id);
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t teach this course.
      </div>
    );
  }

  const book = await getCourseGradebook(courseId);
  if (!book) notFound();

  const plan = buildWeightPlan(book.assessments);
  const marks = book.students.map((s) =>
    computeStudentMark(plan, book.resultsByStudent.get(s.id) ?? []),
  );
  const stats = summariseClass(marks);
  const allResults = book.students.map(
    (s) => book.resultsByStudent.get(s.id) ?? [],
  );

  const maxBand = Math.max(1, ...stats.distribution);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/gradebook">← All courses</Link>
        </Button>
      </div>

      <header className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-primary-foreground/70 text-xs">Gradebook</p>
            <h1 className="font-display mt-1 text-2xl leading-tight tracking-tight">
              {book.course.name}
            </h1>
            <p className="text-primary-foreground/70 mt-2 inline-flex items-center gap-1 text-sm">
              <Users className="size-4" />
              {book.students.length}{" "}
              {book.students.length === 1 ? "student" : "students"} ·{" "}
              {book.assessments.length} assessments
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Class average
              </p>
              <p className="font-display text-2xl tabular-nums">
                {fmt(stats.mean)}
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Median
              </p>
              <p className="font-display text-2xl tabular-nums">
                {fmt(stats.median)}
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Range
              </p>
              <p className="font-display text-2xl tabular-nums">
                {stats.min == null ? "—" : `${fmt(stats.min)}–${fmt(stats.max)}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ───── Distribution ───── */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Spread
          </h2>
          <span className="text-muted-foreground text-xs">
            {stats.gradedStudents} of {stats.totalStudents} students have a
            mark
          </span>
        </div>
        <Separator className="my-4" />
        <div className="flex h-32 items-end gap-1.5">
          {stats.distribution.map((count, band) => (
            <div key={band} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {count > 0 ? count : ""}
              </span>
              <div
                className={
                  band >= 7
                    ? "bg-emerald-500/70 w-full rounded-t"
                    : band >= 5
                      ? "bg-brand-terracotta/70 w-full rounded-t"
                      : "bg-destructive/60 w-full rounded-t"
                }
                style={{
                  height: `${Math.max(count > 0 ? 6 : 2, (count / maxBand) * 100)}%`,
                }}
              />
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {band * 10}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ───── Weights ───── */}
      <WeightsEditor courseId={book.course.id} assessments={book.assessments} />

      {/* ───── Grid ───── */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Students
          </h2>
          <span className="text-muted-foreground text-xs">
            Weighted marks · click a student for the breakdown
          </span>
        </div>
        <Separator />

        {book.students.length === 0 ? (
          <div className="text-muted-foreground p-12 text-center text-sm">
            Nobody is enrolled in this course yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left font-medium">
                    Student
                  </th>
                  {plan.assessments.map((a) => (
                    <th
                      key={a.id}
                      className="px-3 py-2 text-right font-medium whitespace-nowrap"
                      title={`${a.title} — ${Math.round(a.effectiveWeight * 10) / 10}% of the final mark`}
                    >
                      <span className="block max-w-28 truncate">{a.title}</span>
                      <span className="text-muted-foreground/70 block tabular-nums font-normal">
                        {Math.round(a.effectiveWeight * 10) / 10}%
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                    Mark to date
                  </th>
                  <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                    Of course
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {book.students.map((student, i) => {
                  const mark = marks[i];
                  return (
                    <tr key={student.id} className="hover:bg-muted/40 transition-colors">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <Link
                          href={`/dashboard/gradebook/${book.course.id}/${student.id}`}
                          className="block"
                        >
                          <p className="font-medium text-foreground leading-tight">
                            {student.fullName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {student.email}
                          </p>
                        </Link>
                      </td>
                      {mark.rows.map((row) => (
                        <td
                          key={row.assessment.id}
                          className="px-3 py-3 text-right tabular-nums"
                        >
                          {row.percent == null ? (
                            <span className="text-muted-foreground/50">—</span>
                          ) : (
                            <span className={markTone(row.percent)}>
                              {fmt(row.percent)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-display text-base tabular-nums ${markTone(mark.markToDate)}`}
                        >
                          {fmt(mark.markToDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-muted-foreground tabular-nums">
                          {fmt(mark.markOfCourse)}
                        </span>
                        <span className="text-muted-foreground/60 block text-[10px] tabular-nums">
                          {fmt(mark.coverage)} graded
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <ChevronRight className="text-muted-foreground size-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 text-xs">
                <tr>
                  <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2 font-medium text-muted-foreground">
                    Class average
                  </td>
                  {plan.assessments.map((a) => (
                    <td
                      key={a.id}
                      className="text-muted-foreground px-3 py-2 text-right tabular-nums"
                    >
                      {fmt(assessmentAverage(a.id, allResults))}
                    </td>
                  ))}
                  <td className="text-muted-foreground px-4 py-2 text-right tabular-nums">
                    {fmt(stats.mean)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {plan.warning && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-destructive text-sm">
            <Badge variant="secondary" className="mr-2">
              Heads up
            </Badge>
            {plan.warning}
          </p>
        </Card>
      )}
    </div>
  );
}
