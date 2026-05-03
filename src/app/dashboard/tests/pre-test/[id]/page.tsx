/**
 * /dashboard/tests/pre-test/[id] - pre-test instructions screen.
 *
 * Server Component. Shows test metadata and a "Begin test" client island
 * that creates the IN_PROGRESS submission and routes the student into the
 * runner. Idempotent - if a submission already exists the server side
 * redirects forward instead of showing this screen.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileQuestion,
  Hourglass,
  ScrollText,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  getTestDetailById,
  getTestSubmissionByStudentAndTest,
  studentCanAccessTest,
} from "@/features/assessments/queries";
import { BeginTestButton } from "@/features/assessments/components/begin-test-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Begin test" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function PreTestPage({ params }: PageProps) {
  const { id: testId } = await params;

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

  const canAccess = await studentCanAccessTest(testId, student.id);
  if (!canAccess) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        This test isn&apos;t available right now.
      </div>
    );
  }

  const [test, submission] = await Promise.all([
    getTestDetailById(testId),
    getTestSubmissionByStudentAndTest(student.id, testId),
  ]);

  if (!test) notFound();

  // Already started or finished - skip the landing.
  if (submission?.status === "IN_PROGRESS") {
    redirect(`/dashboard/tests/${testId}`);
  }
  if (submission?.status === "SUBMITTED" || submission?.status === "GRADED") {
    redirect(`/dashboard/tests/review/${testId}`);
  }

  const topQuestionCount = test.questions.filter((q) => q.parentId === null).length;

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/dashboard/courses/${test.courseId}`}>
                <ArrowLeft className="size-4" /> Back to course
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <header className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {test.course.name} - with {test.course.tutor.fullName}
          </p>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
            {test.title}
          </h1>
          {test.description && (
            <p className="text-muted-foreground text-sm">{test.description}</p>
          )}
        </header>

        <Card className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <Stat
            icon={<CalendarDays className="size-4" />}
            label="Due"
            value={dateFmt.format(test.dueDate)}
          />
          <Stat
            icon={<FileQuestion className="size-4" />}
            label="Questions"
            value={String(topQuestionCount)}
          />
          <Stat
            icon={<Hourglass className="size-4" />}
            label="Time limit"
            value={test.timeLimit ? `${test.timeLimit} min` : "Untimed"}
          />
        </Card>

        {test.preTestInstructions && (
          <Card className="space-y-3 p-6">
            <h2 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
              <ScrollText className="text-brand-terracotta size-4" />
              Before you begin
            </h2>
            <p className="text-foreground whitespace-pre-wrap text-sm">
              {test.preTestInstructions}
            </p>
          </Card>
        )}

        <Card className="space-y-4 p-6">
          <p className="text-muted-foreground text-sm">
            Once you begin the timer starts immediately
            {test.timeLimit ? " and you have " + test.timeLimit + " minutes." : "."}{" "}
            Drafts auto-save every few seconds, so you can refresh or
            navigate away and resume.
          </p>
          <div className="flex justify-end">
            <BeginTestButton
              testId={test.id}
              redirectTo={`/dashboard/tests/${test.id}`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <p className="font-display text-foreground text-base tabular-nums">{value}</p>
    </div>
  );
}
