/**
 * /dashboard/analytics — tutor analytics dashboard.
 *
 * Shows the tutor a cross-course view of student performance:
 *   - Score distribution histogram per graded item (colour-coded: sage
 *     for >=80, terracotta for the middle, destructive for <=50)
 *   - Class average per course (bar)
 *   - Assignment vs test point split (donut)
 *   - Grade timeline (line, one series per course)
 *
 * Server Component. Data is drawn from listCoursesByTutorId +
 * listGradesForCourse so it reflects whatever has been graded so far.
 */

import Image from "next/image";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { listCoursesByTutorId } from "@/features/courses/queries";
import {
  listGradesForCourse,
} from "@/features/grades/queries";
import {
  BarChart,
  DonutChart,
  Histogram,
  LineChart,
  type BarDatum,
  type LineSeries,
} from "@/features/grades/components/charts";

export const metadata = { title: "Analytics" };

function pct(score: number, outOf: number) {
  if (outOf <= 0) return null;
  return Math.round((score / outOf) * 100);
}

export default async function TutorAnalyticsPage() {
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

  const courses = await listCoursesByTutorId(tutor.id);
  const gradesByCourse = await Promise.all(
    courses.map(async (c) => ({
      course: c,
      grades: await listGradesForCourse(c.id),
    })),
  );

  const allGrades = gradesByCourse.flatMap((g) => g.grades);

  // ---------- top-line stats -------------------------------------------
  const studentSet = new Set(allGrades.map((g) => g.student.id));
  const totalScore = allGrades.reduce((s, g) => s + g.score, 0);
  const totalOutOf = allGrades.reduce((s, g) => s + g.outOf, 0);
  const overall = pct(totalScore, totalOutOf);

  // ---------- charts ----------------------------------------------------
  // Bar: average per course
  const barData: BarDatum[] = gradesByCourse.map(({ course, grades }) => {
    const s = grades.reduce((acc, g) => acc + g.score, 0);
    const o = grades.reduce((acc, g) => acc + g.outOf, 0);
    return {
      label: course.name,
      value: pct(s, o) ?? 0,
      meta: `${grades.length} grades`,
    };
  });

  // Line: timeline per course
  const lineSeries: LineSeries[] = gradesByCourse.map(({ course, grades }) => ({
    name: course.name,
    points: grades
      .map((g) => ({
        x: g.updatedAt.getTime(),
        y: pct(g.score, g.outOf) ?? 0,
        label: `${g.student.fullName} — ${g.title}`,
      }))
      .sort((a, b) => a.x - b.x),
  }));

  // Donut: tests vs assignments (by points)
  const testPoints = allGrades
    .filter((g) => g.type === "TEST")
    .reduce((s, g) => s + g.outOf, 0);
  const assignmentPoints = allGrades
    .filter((g) => g.type === "ASSIGNMENT" || g.type === "SUBMISSION")
    .reduce((s, g) => s + g.outOf, 0);

  // Histograms: one per graded assignment/test with >=1 grade
  const byItem = new Map<
    string,
    { title: string; kind: "test" | "assignment"; values: number[] }
  >();
  for (const g of allGrades) {
    const key = g.testSubmission?.test.id
      ? `test:${g.testSubmission.test.id}`
      : g.submissionEntry?.submission.id
        ? `sub:${g.submissionEntry.submission.id}`
        : `grade:${g.id}`;
    const title =
      g.testSubmission?.test.title ??
      g.submissionEntry?.submission.title ??
      g.title;
    const kind: "test" | "assignment" = g.testSubmission?.test.id
      ? "test"
      : "assignment";
    if (!byItem.has(key)) {
      byItem.set(key, { title, kind, values: [] });
    }
    const pctVal = pct(g.score, g.outOf);
    if (pctVal != null) byItem.get(key)!.values.push(pctVal);
  }

  const distributionRows = Array.from(byItem.values())
    .filter((r) => r.values.length > 0)
    .sort((a, b) => b.values.length - a.values.length);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">
              {tutor.fullName.split(" ")[0]}&apos;s teaching analytics
            </p>
            <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
              Class performance
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              How your students are doing across every course you teach.
              Distribution charts help you spot items that need re-teaching.
            </p>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                  Students graded
                </p>
                <p className="font-display text-2xl tabular-nums">
                  {studentSet.size}
                </p>
              </div>
              <div>
                <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                  Grades issued
                </p>
                <p className="font-display text-2xl tabular-nums">
                  {allGrades.length}
                </p>
              </div>
              {overall != null && (
                <div>
                  <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                    Overall class avg
                  </p>
                  <p className="font-display text-2xl tabular-nums">
                    {overall}%
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="relative hidden h-40 w-56 shrink-0 md:block">
            <Image
              src="/illustrations/dashboard.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      {allGrades.length === 0 ? (
        <Card className="flex min-h-70 flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <BarChart3 className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No grades yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Once you&apos;ve graded a few tests and assignments, this page
              will show class-wide distributions and per-course trends.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Timeline
                </h2>
                <p className="text-muted-foreground text-xs">
                  Every graded item, coloured by course.
                </p>
              </div>
              <LineChart series={lineSeries} height={220} />
            </Card>
            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Tests vs assignments
                </h2>
                <p className="text-muted-foreground text-xs">
                  By total points graded.
                </p>
              </div>
              <DonutChart
                slices={[
                  { label: "Tests", value: testPoints },
                  { label: "Assignments", value: assignmentPoints },
                ]}
                size={160}
                centerLabel="items"
                centerValue={String(allGrades.length)}
              />
            </Card>
          </section>

          <section>
            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Class average per course
                </h2>
                <p className="text-muted-foreground text-xs">
                  Point-weighted across every graded item in the course.
                </p>
              </div>
              <BarChart data={barData} height={240} />
            </Card>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">
                Distributions
              </h2>
              <p className="text-muted-foreground text-sm">
                Score histogram per graded item — spot the items that need
                re-teaching.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {distributionRows.map((row, i) => {
                const avg =
                  row.values.reduce((a, b) => a + b, 0) / row.values.length;
                return (
                  <Card key={i} className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {row.title}
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          {row.values.length}{" "}
                          {row.values.length === 1 ? "grade" : "grades"} · avg{" "}
                          <span className="text-foreground font-medium tabular-nums">
                            {Math.round(avg)}%
                          </span>
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          row.kind === "test"
                            ? "bg-brand-terracotta text-brand-terracotta-foreground"
                            : ""
                        }
                      >
                        {row.kind === "test" ? "Test" : "Assignment"}
                      </Badge>
                    </div>
                    <Histogram values={row.values} height={160} />
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
