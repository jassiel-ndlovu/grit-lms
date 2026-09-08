/**
 * /dashboard/grades — student's gradebook with analytics.
 *
 * Server Component. Lists every Grade row owned by the calling student,
 * plus three charts:
 *   - score-over-time line (one line per course)
 *   - average-per-course bar
 *   - assignment vs test donut
 *
 * The transcript is unchanged from the previous version — analytics sit
 * above so students see the story at a glance, then can drill into any
 * individual grade for per-question feedback.
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { listGradesForStudent } from "@/features/grades/queries";
import {
  BarChart,
  DonutChart,
  LineChart,
  type LineSeries,
  type BarDatum,
} from "@/features/grades/components/charts";

export const metadata = { title: "Grades" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function pct(score: number, outOf: number) {
  if (outOf <= 0) return null;
  return Math.round((score / outOf) * 100);
}

export default async function StudentGradesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true, fullName: true },
  });
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const grades = await listGradesForStudent(student.id);

  // Group by course for the transcript layout + per-course averages.
  const byCourse = new Map<string, { name: string; rows: typeof grades }>();
  for (const g of grades) {
    const key = g.course.id;
    if (!byCourse.has(key)) {
      byCourse.set(key, { name: g.course.name, rows: [] });
    }
    byCourse.get(key)!.rows.push(g);
  }

  // Aggregate stats for the header.
  const totalScore = grades.reduce((s, g) => s + g.score, 0);
  const totalOutOf = grades.reduce((s, g) => s + g.outOf, 0);
  const overall = pct(totalScore, totalOutOf);

  // -------- chart data ---------------------------------------------------
  const lineSeries: LineSeries[] = Array.from(byCourse.entries()).map(
    ([, group]) => ({
      name: group.name,
      points: group.rows
        .map((g) => ({
          x: g.updatedAt.getTime(),
          y: pct(g.score, g.outOf) ?? 0,
          label: g.title,
        }))
        .sort((a, b) => a.x - b.x),
    }),
  );

  const barData: BarDatum[] = Array.from(byCourse.entries()).map(
    ([, group]) => {
      const s = group.rows.reduce((acc, g) => acc + g.score, 0);
      const o = group.rows.reduce((acc, g) => acc + g.outOf, 0);
      return {
        label: group.name,
        value: pct(s, o) ?? 0,
        meta: `${group.rows.length} ${group.rows.length === 1 ? "grade" : "grades"}`,
      };
    },
  );

  const testPoints = grades
    .filter((g) => g.type === "TEST")
    .reduce((s, g) => s + g.outOf, 0);
  const assignmentPoints = grades
    .filter((g) => g.type === "ASSIGNMENT" || g.type === "SUBMISSION")
    .reduce((s, g) => s + g.outOf, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">
              {student.fullName.split(" ")[0]}&apos;s transcript
            </p>
            <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
              Grades &amp; performance
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Track your progress across every course. Click any row to see
              per-question feedback from your tutor.
            </p>
            {overall != null && (
              <div className="mt-4">
                <p className="text-primary-foreground/60 text-xs uppercase tracking-wide">
                  Overall average
                </p>
                <p className="font-display text-3xl tabular-nums">{overall}%</p>
              </div>
            )}
          </div>
          <div className="relative hidden h-40 w-56 shrink-0 md:block">
            <Image
              src="/illustrations/success-factors.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      {grades.length === 0 ? (
        <Card className="flex min-h-70 flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <Award className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No grades yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Once your tutors grade your tests and assignments, results show
              up here alongside your charts.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Score over time
                </h2>
                <p className="text-muted-foreground text-xs">
                  Each dot is a graded item. Hover for details.
                </p>
              </div>
              <LineChart series={lineSeries} height={220} />
            </Card>

            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Points split
                </h2>
                <p className="text-muted-foreground text-xs">
                  Where your points come from.
                </p>
              </div>
              <DonutChart
                slices={[
                  { label: "Tests", value: testPoints },
                  { label: "Assignments", value: assignmentPoints },
                ]}
                size={160}
                centerLabel="graded"
                centerValue={String(grades.length)}
              />
            </Card>
          </section>

          <section>
            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-display text-lg leading-tight">
                  Average by course
                </h2>
                <p className="text-muted-foreground text-xs">
                  Weighted by points on each graded item.
                </p>
              </div>
              <BarChart data={barData} height={240} />
            </Card>
          </section>

          <section className="space-y-6">
            <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">
              Transcript
            </h2>
            {Array.from(byCourse.entries()).map(([courseId, group]) => {
              const courseScore = group.rows.reduce((s, g) => s + g.score, 0);
              const courseOutOf = group.rows.reduce((s, g) => s + g.outOf, 0);
              const coursePct = pct(courseScore, courseOutOf);
              return (
                <Card key={courseId} className="overflow-hidden p-0">
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <h3 className="font-display text-lg leading-tight tracking-tight text-foreground">
                        {group.name}
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        {group.rows.length}{" "}
                        {group.rows.length === 1 ? "grade" : "grades"}
                      </p>
                    </div>
                    {coursePct != null && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">
                          Course avg
                        </p>
                        <p className="font-display text-xl tabular-nums text-foreground">
                          {coursePct}%
                        </p>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <ul className="divide-border divide-y">
                    {group.rows.map((g) => {
                      const itemPct = pct(g.score, g.outOf);
                      const linkedTitle =
                        g.testSubmission?.test.title ??
                        g.submissionEntry?.submission.title ??
                        g.title;
                      const href = `/dashboard/grades/${g.id}`;
                      return (
                        <li key={g.id}>
                          <Link
                            href={href}
                            className="hover:bg-muted/40 block transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3 px-5 py-3">
                              <div className="min-w-0 space-y-0.5">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {linkedTitle}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {g.type === "TEST" ? "Test" : "Assignment"} ·
                                  graded {dateFmt.format(g.updatedAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {itemPct != null && (
                                  <Badge
                                    variant={itemPct >= 50 ? "soft" : "secondary"}
                                    className="tabular-nums"
                                  >
                                    {itemPct}%
                                  </Badge>
                                )}
                                <span className="font-display tabular-nums text-foreground text-sm">
                                  {g.score}
                                  <span className="text-muted-foreground">
                                    {" "}
                                    / {g.outOf}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
