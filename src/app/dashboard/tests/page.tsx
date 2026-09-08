/**
 * /dashboard/tests — student's catalogue of tests across enrolled courses.
 *
 * Server Component. Pulls active tests for the calling student and the
 * student's submission for each. Tabs compartmentalise into upcoming,
 * missed, submitted, and graded so students can jump straight to what
 * they need to do vs. what they've already done.
 */

import Image from "next/image";
import { redirect } from "next/navigation";
import { Target } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  getTestSubmissionByStudentAndTest,
  listActiveTestsForStudent,
} from "@/features/assessments/queries";
import { TestCard } from "@/features/assessments/components/test-card";
import { TestGrid } from "@/features/assessments/components/test-grid";
import { TestsTabs } from "@/features/assessments/components/tests-tabs";
import {
  bucketCounts,
  filterByBucket,
  type FilterBucket,
} from "@/features/assessments/lib/filters";

export const metadata = { title: "Tests & Quizzes" };

type SubmissionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "GRADED"
  | "LATE"
  | "NOT_SUBMITTED";

export default async function StudentTestsPage() {
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

  const tests = await listActiveTestsForStudent(student.id);
  const submissions = await Promise.all(
    tests.map((t) => getTestSubmissionByStudentAndTest(student.id, t.id)),
  );

  const rows = tests.map((test, i) => ({
    test,
    submission: submissions[i],
    dueDate: test.dueDate,
    status: submissions[i]?.status ?? "NOT_STARTED",
  }));

  const counts = bucketCounts(rows);

  function renderBucket(b: FilterBucket) {
    const filtered = filterByBucket(rows, b).sort(
      (a, b) => a.test.dueDate.getTime() - b.test.dueDate.getTime(),
    );
    return (
      <TestGrid
        isEmpty={filtered.length === 0}
        empty={
          <div className="border-input rounded-lg border border-dashed p-12 text-center">
            <Target className="text-muted-foreground mx-auto size-10" />
            <h3 className="font-display mt-3 text-lg text-foreground">
              Nothing here
            </h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
              {b === "upcoming"
                ? "No upcoming tests — you're all caught up."
                : b === "missed"
                  ? "No missed tests. Nice."
                  : b === "submitted"
                    ? "No tests waiting to be graded."
                    : b === "graded"
                      ? "No graded tests yet."
                      : "No active tests."}
            </p>
          </div>
        }
      >
        {filtered.map(({ test, submission }) => (
          <TestCard
            key={test.id}
            test={test}
            submission={
              submission
                ? {
                    status: submission.status as SubmissionStatus,
                    score: submission.score,
                    grade: submission.grade
                      ? {
                          score: submission.grade.score,
                          outOf: submission.grade.outOf,
                        }
                      : null,
                  }
                : null
            }
            href={
              submission?.status === "GRADED" ||
              submission?.status === "SUBMITTED"
                ? `/dashboard/tests/review/${test.id}`
                : `/dashboard/tests/pre-test/${test.id}`
            }
          />
        ))}
      </TestGrid>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">
              Assessments
            </p>
            <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
              Tests &amp; quizzes
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Active assessments across your courses, sorted by what needs
              your attention first.
            </p>
          </div>
          <div className="relative hidden h-40 w-56 shrink-0 md:block">
            <Image
              src="/illustrations/research-paper.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <TestsTabs
        counts={counts}
        panels={{
          all: renderBucket("all"),
          upcoming: renderBucket("upcoming"),
          missed: renderBucket("missed"),
          submitted: renderBucket("submitted"),
          graded: renderBucket("graded"),
        }}
      />
    </div>
  );
}
