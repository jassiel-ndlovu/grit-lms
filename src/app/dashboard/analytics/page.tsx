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

import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { auth } from "@/lib/auth";
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
import { teacherFrom } from "@/features/courses/lib/teacher";
import HeaderAnalytics from "@/components/illustrations/generated/header-analytics";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
// Personal analytics: the courses this user teaches, owners included (#192).
import { tutorScope } from "@/features/courses/lib/course-access";

export const metadata = { title: "Analytics" };

function pct(score: number, outOf: number) {
  if (outOf <= 0) return null;
  return Math.round((score / outOf) * 100);
}

export default async function TutorAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = teacherFrom(session.user);

  const courses = await listCoursesByTutorId(tutorScope(tutor.id));
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
      meta: `${grades.length} ${grades.length === 1 ? "mark" : "marks"} given`,
    };
  });

  // Line: timeline per course
  const lineSeries: LineSeries[] = gradesByCourse.map(({ course, grades }) => ({
    name: course.name,
    points: grades
      .map((g) => ({
        x: g.updatedAt.getTime(),
        y: pct(g.score, g.outOf) ?? 0,
        label: `${g.student.fullName}: ${g.title}`,
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
    <PageFrame type="list" breadcrumb={[{ label: "Analytics" }]}>
      <PageTitle
        eyebrow={`${tutor.fullName.split(" ")[0]}'s classes`}
        title="Analytics"
        description="How your students are doing on every course you teach, and which tests and assignments they found hard."
        illustration={<HeaderAnalytics />}
        properties={
          <StatTiles>
            <StatTile label="Students with marks" value={studentSet.size} />
            <StatTile label="Marks given" value={allGrades.length} />
            {overall != null ? <StatTile label="Average of all marks" value={`${overall}%`} /> : null}
          </StatTiles>
        }
      />

      {allGrades.length === 0 ? (
        <Card className="flex min-h-70 flex-col items-center justify-center gap-4 p-8 sm:p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <BarChart3 className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No marks yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              After you mark a few tests and assignments, this page shows averages for each course and how marks are spread.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Marks over time
                </h2>
                <p className="text-muted-foreground text-xs">
                  Each dot is one marked test or assignment. Each course has its own colour.
                </p>
              </div>
              <LineChart series={lineSeries} height={220} />
            </Card>
            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Tests and assignments
                </h2>
                <p className="text-muted-foreground text-xs">
                  How much of the total marks came from each.
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
                  Class average for each course
                </h2>
                <p className="text-muted-foreground text-xs">
                  Tests and assignments with more marks count for more.
                </p>
              </div>
              <BarChart data={barData} height={240} />
            </Card>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">
                How marks are spread
              </h2>
              <p className="text-muted-foreground text-sm">
                How many students got each range of marks, for each test and assignment. Low ones may need teaching again.
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
                          {row.values.length === 1 ? "student" : "students"} · average{" "}
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
    </PageFrame>
  );
}
