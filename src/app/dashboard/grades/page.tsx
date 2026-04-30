/**
 * /dashboard/grades — student's gradebook.
 *
 * Server Component. Lists every Grade row owned by the calling student,
 * grouped by course so the page reads like a transcript. Each row links
 * back to the corresponding test review or assignment review surface so
 * the student can see per-question feedback in context.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Award } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { listGradesForStudent } from "@/features/grades/queries";

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
    select: { id: true },
  });
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const grades = await listGradesForStudent(student.id);

  // Group by course for the transcript layout.
  const byCourse = new Map<string, { name: string; rows: typeof grades }>();
  for (const g of grades) {
    const key = g.course.id;
    if (!byCourse.has(key)) {
      byCourse.set(key, { name: g.course.name, rows: [] });
    }
    byCourse.get(key)!.rows.push(g);
  }

  // Aggregate stats for the header summary.
  const totalScore = grades.reduce((s, g) => s + g.score, 0);
  const totalOutOf = grades.reduce((s, g) => s + g.outOf, 0);
  const overall = pct(totalScore, totalOutOf);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            Grades
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Your scores across every course, newest first.
          </p>
        </div>
        {overall != null && (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Overall average</p>
            <p className="font-display text-3xl tabular-nums text-foreground">
              {overall}%
            </p>
          </div>
        )}
      </header>

      {grades.length === 0 ? (
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <Award className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No grades yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Once your tutors grade your tests and assignments, results show up
              here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(byCourse.entries()).map(([courseId, group]) => {
            const courseScore = group.rows.reduce((s, g) => s + g.score, 0);
            const courseOutOf = group.rows.reduce((s, g) => s + g.outOf, 0);
            const coursePct = pct(courseScore, courseOutOf);

            return (
              <Card key={courseId} className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
                      {group.name}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      {group.rows.length}{" "}
                      {group.rows.length === 1 ? "grade" : "grades"}
                    </p>
                  </div>
                  {coursePct != null && (
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Course avg</p>
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
                    const href = g.testSubmission
                      ? `/dashboard/tests/review/${g.testSubmission.test.id}`
                      : g.submissionEntry
                        ? `/dashboard/submissions/${g.submissionEntry.submission.id}`
                        : null;

                    const Row = (
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
                    );

                    return (
                      <li key={g.id}>
                        {href ? (
                          <Link
                            href={href}
                            className="hover:bg-muted/40 block transition-colors"
                          >
                            {Row}
                          </Link>
                        ) : (
                          Row
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
