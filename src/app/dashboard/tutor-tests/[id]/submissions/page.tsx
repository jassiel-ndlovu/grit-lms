/**
 * /dashboard/tutor-tests/[id]/submissions - tutor's view of every
 * student submission for a given test.
 *
 * Server Component. Resolves the calling tutor, asserts ownership of the
 * test via testBelongsToTutor, then pulls every submission via
 * listSubmissionsForTest. Each row links to the per-student grading view
 * (legacy /dashboard/tutor-tests/submissions/[id]/(student)/[studentId]
 * for now - the new grading UI lands in a follow-up).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, GraduationCap, Inbox } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getTestDetailById,
  listSubmissionsForTest,
  testBelongsToTutor,
} from "@/features/assessments/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Test submissions" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function pct(score: number, outOf: number) {
  if (outOf <= 0) return null;
  return Math.round((score / outOf) * 100);
}

export default async function TutorTestSubmissionsPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

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

  const owns = await testBelongsToTutor(testId, tutor.id);
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this test.
      </div>
    );
  }

  const [test, submissions] = await Promise.all([
    getTestDetailById(testId),
    listSubmissionsForTest(testId),
  ]);
  if (!test) notFound();

  // Quick aggregate for the header summary.
  const graded = submissions.filter((s) => s.status === "GRADED").length;
  const submitted = submissions.filter((s) => s.status === "SUBMITTED").length;
  const inProgress = submissions.filter((s) => s.status === "IN_PROGRESS").length;

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/tutor-tests">
                <ArrowLeft className="size-4" /> All tests
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <header className="space-y-2">
          <p className="text-muted-foreground text-xs">{test.course.name}</p>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {test.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <span>Due {dateFmt.format(test.dueDate)}</span>
            <span>·</span>
            <span>{test.totalPoints} points</span>
            <span>·</span>
            <span>
              {submissions.length}{" "}
              {submissions.length === 1 ? "submission" : "submissions"}
              {" "}({graded} graded, {submitted} awaiting, {inProgress} in progress)
            </span>
          </div>
        </header>

        <Card className="overflow-hidden p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 py-4">
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
              Submissions
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {submissions.length} total
            </span>
          </div>
          <Separator />
          {submissions.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 p-12 text-center text-sm">
              <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-12 items-center justify-center rounded-full">
                <Inbox className="size-5" />
              </div>
              <p>No student has started this test yet.</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {submissions.map((s) => {
                const itemPct =
                  s.grade != null ? pct(s.grade.score, s.grade.outOf) : null;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/dashboard/tutor-tests/submissions/${test.id}/${s.studentId}`}
                      className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                    >
                      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {s.student.fullName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {s.student.email}
                          {s.submittedAt
                            ? ` · submitted ${dateFmt.format(s.submittedAt)}`
                            : ` · started ${dateFmt.format(s.startedAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant={
                            s.status === "GRADED"
                              ? "brand"
                              : s.status === "SUBMITTED"
                                ? "soft"
                                : "secondary"
                          }
                        >
                          {s.status === "GRADED"
                            ? "Graded"
                            : s.status === "SUBMITTED"
                              ? "Awaiting grade"
                              : "In progress"}
                        </Badge>
                        {s.grade && itemPct != null && (
                          <span className="font-display tabular-nums text-foreground text-sm">
                            {s.grade.score}
                            <span className="text-muted-foreground">
                              {" "}
                              / {s.grade.outOf}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              ({itemPct}%)
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

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={`/dashboard/manage-courses/${test.courseId}`}>
              <GraduationCap className="size-4" /> Manage course
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
