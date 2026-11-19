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

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusChip } from "@/components/shell/status-chip";

import {
  getTestDetailById,
  listSubmissionsForTest,
  testBelongsToTutor,
} from "@/features/assessments/queries";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { TestFrame } from "@/features/assessments/components/test-frame";

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

  const chip = (status: string) =>
    status === "GRADED"
      ? { tone: "success" as const, label: "Graded" }
      : status === "SUBMITTED"
        ? { tone: "info" as const, label: "To mark" }
        : { tone: "neutral" as const, label: "In progress" };

  return (
    <TestFrame test={test} page="Submissions">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="space-y-1">
          <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">
            {test.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            Due {dateFmt.format(test.dueDate)} · {test.totalPoints} points · {submissions.length}{" "}
            {submissions.length === 1 ? "submission" : "submissions"} ({graded} graded, {submitted} to mark,{" "}
            {inProgress} in progress)
          </p>
        </header>

        {submissions.length === 0 ? (
          <EmptyState
            compact
            illustration={<Scene name="nothing-to-grade" />}
            title="No one has started this test yet"
            description="Attempts show up here as students start them."
          />
        ) : (
          <ul className="divide-border border-border divide-y border-y">
            {submissions.map((s) => {
              const itemPct = s.grade != null ? pct(s.grade.score, s.grade.outOf) : null;
              const c = chip(s.status);
              return (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/tutor-tests/submissions/${test.id}/${s.studentId}`}
                    className="hover:bg-muted/40 flex items-center gap-3 px-2 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-foreground truncate text-sm font-medium">{s.student.fullName}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {s.student.email}
                        {s.submittedAt
                          ? ` · submitted ${dateFmt.format(s.submittedAt)}`
                          : ` · started ${dateFmt.format(s.startedAt)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusChip tone={c.tone}>{c.label}</StatusChip>
                      {s.grade && itemPct != null ? (
                        <span className="text-foreground text-sm tabular-nums">
                          {s.grade.score}
                          <span className="text-muted-foreground"> / {s.grade.outOf}</span>
                          <span className="text-muted-foreground text-xs"> ({itemPct}%)</span>
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TestFrame>
  );
}
