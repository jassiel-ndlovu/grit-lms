/**
 * /dashboard/gradebook/[courseId]/[studentId] — one student, in full.
 *
 * Shows the weighted mark, how much of the course has been graded, and a
 * row per assessment with the raw result, the weight it carries and what it
 * contributed. Each row also carries the class average so the tutor can see
 * where this student sits without flipping back to the class view.
 *
 * Server Component, tutor-only.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GraduationCap, Mail } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  courseBelongsToTutor,
  getCourseGradebook,
  parseAssessmentKey,
} from "@/features/grades/gradebook";
import {
  assessmentAverage,
  buildWeightPlan,
  computeStudentMark,
  summariseClass,
} from "@/features/grades/lib/weighting";

interface PageProps {
  params: Promise<{ courseId: string; studentId: string }>;
}

export const metadata = { title: "Student marks" };

function fmt(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}%`;
}

function markTone(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 50) return "text-foreground";
  return "text-destructive";
}

/** Where the tutor goes to actually mark this assessment. */
function gradeHref(key: string, studentId: string): string | null {
  const parsed = parseAssessmentKey(key);
  if (!parsed) return null;
  return parsed.kind === "assignment"
    ? `/dashboard/submissions/overview/${parsed.id}/${studentId}`
    : `/dashboard/tutor-tests/submissions/${parsed.id}/${studentId}`;
}

export default async function StudentGradebookPage({ params }: PageProps) {
  const { courseId, studentId } = await params;

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

  const student = book.students.find((s) => s.id === studentId);
  if (!student) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/gradebook/${courseId}`}>← Back to class</Link>
        </Button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">
            That student isn&apos;t enrolled in this course.
          </p>
        </Card>
      </div>
    );
  }

  const plan = buildWeightPlan(book.assessments);
  const mark = computeStudentMark(plan, book.resultsByStudent.get(studentId) ?? []);
  const stats = summariseClass(
    book.students.map((s) =>
      computeStudentMark(plan, book.resultsByStudent.get(s.id) ?? []),
    ),
  );
  const allResults = book.students.map(
    (s) => book.resultsByStudent.get(s.id) ?? [],
  );

  const vsClass =
    mark.markToDate != null && stats.mean != null
      ? Math.round((mark.markToDate - stats.mean) * 10) / 10
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/gradebook/${courseId}`}>← Back to class</Link>
        </Button>
      </div>

      <header className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary-foreground/15 flex size-12 items-center justify-center rounded-full text-lg font-semibold">
              {student.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl leading-tight tracking-tight">
                {student.fullName}
              </h1>
              <p className="text-primary-foreground/70 truncate text-sm">
                {book.course.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                Mark to date
              </p>
              <p className="font-display text-3xl tabular-nums">
                {fmt(mark.markToDate)}
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                vs class
              </p>
              <p className="font-display text-3xl tabular-nums">
                {vsClass == null
                  ? "—"
                  : `${vsClass > 0 ? "+" : ""}${vsClass}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Of the whole course
          </p>
          <p className="font-display mt-1 text-2xl tabular-nums text-foreground">
            {fmt(mark.markOfCourse)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Counting ungraded assessments as zero.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Graded so far
          </p>
          <p className="font-display mt-1 text-2xl tabular-nums text-foreground">
            {fmt(mark.coverage)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Share of the course weight that has been marked.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Class average
          </p>
          <p className="font-display mt-1 text-2xl tabular-nums text-foreground">
            {fmt(stats.mean)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Across {stats.gradedStudents} graded{" "}
            {stats.gradedStudents === 1 ? "student" : "students"}.
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Assessments
          </h2>
          <span className="text-muted-foreground text-xs">
            {mark.rows.filter((r) => r.percent != null).length} of{" "}
            {mark.rows.length} graded
          </span>
        </div>
        <Separator />

        {mark.rows.length === 0 ? (
          <div className="text-muted-foreground p-12 text-center text-sm">
            This course has no assessments yet.
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {mark.rows.map((row) => {
              const href = gradeHref(row.assessment.id, studentId);
              const classAvg = assessmentAverage(row.assessment.id, allResults);
              return (
                <li
                  key={row.assessment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {row.assessment.title}
                          </Link>
                        ) : (
                          row.assessment.title
                        )}
                      </p>
                      <Badge variant="secondary" className="shrink-0">
                        {row.assessment.kind === "test" ? "Test" : "Assignment"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      Worth {Math.round(row.assessment.effectiveWeight * 10) / 10}
                      % {row.assessment.explicit ? "(set)" : "(by points)"}
                      {classAvg != null && ` · class ${fmt(classAvg)}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-6 text-right">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Result
                      </p>
                      <p className="tabular-nums text-sm text-foreground">
                        {row.result
                          ? `${row.result.score}/${row.result.outOf}`
                          : "—"}
                      </p>
                    </div>
                    <div className="w-16">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Percent
                      </p>
                      <p
                        className={`font-display tabular-nums text-base ${markTone(row.percent)}`}
                      >
                        {fmt(row.percent)}
                      </p>
                    </div>
                    <div className="w-20">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Contributes
                      </p>
                      <p className="tabular-nums text-sm text-muted-foreground">
                        {row.percent == null
                          ? "—"
                          : `${Math.round(row.contribution * 10) / 10} pts`}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-brand-terracotta size-4" />
          <p className="text-muted-foreground text-sm">
            Weighted marks are visible to you only — students still see their
            individual grades.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${student.email}`}>
            <Mail className="size-4" /> Email {student.fullName.split(" ")[0]}
          </a>
        </Button>
      </Card>
    </div>
  );
}
