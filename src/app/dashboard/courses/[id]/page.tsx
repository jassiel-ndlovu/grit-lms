/**
 * /dashboard/courses/[id] — student's view of a single course.
 *
 * Server Component. Replaces the legacy 6-tab client page with a clean
 * vertical layout: hero, lessons preview, pending assessments, pending
 * assignments, upcoming events, recent grades. Every section is RSC and
 * reads from the new feature queries - zero client contexts.
 */

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  GraduationCap,
  Hourglass,
  Pencil,
  Target,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { getCourseDetailById } from "@/features/courses/queries";
import {
  listCompletionsForStudentInCourse,
  listLessonsByCourseId,
} from "@/features/lessons/queries";
import {
  getTestSubmissionByStudentAndTest,
  listActiveTestsByCourseId,
} from "@/features/assessments/queries";
import {
  getEntryByStudentAndSubmission,
  listActiveSubmissionsByCourseId,
} from "@/features/submissions/queries";
import { listGradesForStudentInCourse } from "@/features/grades/queries";
import { listEventsByCourseId } from "@/features/events/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function pct(score: number, outOf: number) {
  if (outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}

export const metadata = { title: "Course" };

export default async function StudentCourseDetailPage({ params }: PageProps) {
  const { id: courseId } = await params;

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

  const course = await getCourseDetailById(courseId);
  if (!course) notFound();

  // Enrolment gate.
  const enrolled = course.students.some((s) => s.id === student.id);
  if (!enrolled) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You aren&apos;t enrolled in this course.
      </div>
    );
  }

  // Pull every section in parallel.
  const [lessons, completions, tests, assignments, events, grades] = await Promise.all([
    listLessonsByCourseId(courseId),
    listCompletionsForStudentInCourse(student.id, courseId),
    listActiveTestsByCourseId(courseId),
    listActiveSubmissionsByCourseId(courseId),
    listEventsByCourseId(courseId),
    listGradesForStudentInCourse(student.id, courseId),
  ]);

  // Per-test status lookup.
  const testStatuses = await Promise.all(
    tests.map((t) => getTestSubmissionByStudentAndTest(student.id, t.id)),
  );
  const pendingTests = tests
    .map((t, i) => ({ test: t, sub: testStatuses[i] }))
    .filter(({ sub }) => !sub || sub.status === "IN_PROGRESS");

  // Per-assignment status lookup.
  const entryStatuses = await Promise.all(
    assignments.map((a) => getEntryByStudentAndSubmission(student.id, a.id)),
  );
  const pendingAssignments = assignments
    .map((a, i) => ({ assignment: a, entry: entryStatuses[i] }))
    .filter(
      ({ entry }) =>
        !entry || (entry.status !== "GRADED" && entry.status !== "SUBMITTED"),
    );

  const completedIds = new Set(completions.map((c) => c.lessonId));
  const completedCount = completedIds.size;
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Find the next not-yet-completed lesson so the hero can deep-link to it.
  const nextLesson = lessons.find((l) => !completedIds.has(l.id));

  // Course-level grade rollup.
  const courseScore = grades.reduce((s, g) => s + g.score, 0);
  const courseOutOf = grades.reduce((s, g) => s + g.outOf, 0);
  const courseAverage = courseOutOf > 0 ? pct(courseScore, courseOutOf) : null;

  // Upcoming events only (already future-dated by date >= now in query).
  const upcomingEvents = events.filter((e) => e.date.getTime() >= Date.now()).slice(0, 4);

  return (
    <div className="bg-background min-h-screen">
      {/* ───── Header bar ───── */}
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-14 items-center">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/dashboard/courses">
                <ArrowLeft className="size-4" /> All courses
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ───── Hero ───── */}
      <div className="bg-primary text-primary-foreground border-b-2 border-brand-terracotta">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            {course.imageUrl && (
              <div className="hidden w-60 shrink-0 md:block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-primary-foreground/10 border border-primary-foreground/15">
                  <Image
                    src={course.imageUrl.includes("course") ? `/images/${course.imageUrl}` : course.imageUrl}
                    alt={course.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-primary-foreground/70 text-sm">with {course.tutor.fullName}</p>
                <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
                  {course.name}
                </h1>
                {course.description && (
                  <p className="text-primary-foreground/75 mt-3 max-w-2xl text-sm">
                    {course.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroStat label="Lessons" value={`${completedCount}/${totalLessons}`} />
                <HeroStat label="Progress" value={`${progressPct}%`} />
                <HeroStat label="Average" value={courseAverage != null ? `${courseAverage}%` : "-"} />
                <HeroStat label="Up next" value={String(pendingTests.length + pendingAssignments.length)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-xs text-primary-foreground/70">
                  <span>Course progress</span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/15">
                  <div
                    className="h-full bg-brand-terracotta transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {nextLesson && (
                <Button asChild variant="brand" className="mt-2">
                  <Link href={`/dashboard/courses/lessons/${courseId}?lesson=${nextLesson.id}`}>
                    Continue with {nextLesson.title}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───── Body ───── */}
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {/* Lessons preview */}
        <section className="space-y-4">
          <SectionHeader
            title="Lessons"
            href={`/dashboard/courses/lessons/${courseId}`}
            label="Open lessons"
          />
          {lessons.length === 0 ? (
            <Card className="text-muted-foreground p-12 text-center text-sm">
              No lessons published yet.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-border divide-y">
                {lessons.slice(0, 6).map((lesson, i) => {
                  const done = completedIds.has(lesson.id);
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/dashboard/courses/lessons/${courseId}?lesson=${lesson.id}`}
                        className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
                            done ? "bg-brand-terracotta/15 text-brand-terracotta" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="size-4" /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {lesson.title}
                          </p>
                          {lesson.duration && (
                            <p className="text-muted-foreground text-xs">
                              {lesson.duration} min
                            </p>
                          )}
                        </div>
                        {!done && <Circle className="text-muted-foreground size-4 shrink-0" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        {/* Pending assessments + assignments */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <SectionHeader title="Active tests" href="/dashboard/tests" label="All tests" />
            <Card className="overflow-hidden p-0">
              {pendingTests.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No pending tests in this course.
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {pendingTests.map(({ test, sub }) => (
                    <li key={test.id}>
                      <Link
                        href={`/dashboard/tests/${test.id}`}
                        className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                      >
                        <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                          <Target className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {test.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            Due {dateFmt.format(test.dueDate)}
                            {test.timeLimit ? ` - ${test.timeLimit} min` : ""}
                          </p>
                        </div>
                        <Badge variant={sub?.status === "IN_PROGRESS" ? "secondary" : "soft"} className="shrink-0">
                          {sub?.status === "IN_PROGRESS" ? "In progress" : "Begin"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Active assignments" href="/dashboard/submissions" label="All assignments" />
            <Card className="overflow-hidden p-0">
              {pendingAssignments.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No pending assignments in this course.
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {pendingAssignments.map(({ assignment, entry }) => (
                    <li key={assignment.id}>
                      <Link
                        href={`/dashboard/submissions/${assignment.id}`}
                        className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                      >
                        <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                          <Pencil className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {assignment.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            Due {dateFmt.format(assignment.dueDate)}
                          </p>
                        </div>
                        <Badge variant={entry ? "secondary" : "soft"} className="shrink-0">
                          {entry ? "Resume" : "Submit"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        {/* Schedule + Grades */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <SectionHeader title="Schedule" href="/dashboard/calendar" label="Full schedule" />
            <Card className="overflow-hidden p-0">
              {upcomingEvents.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No upcoming events.
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                        <CalendarDays className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                        <p className="text-muted-foreground text-xs">{event.type}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {dateFmt.format(event.date)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Grades" href="/dashboard/grades" label="All grades" />
            <Card className="overflow-hidden p-0">
              {grades.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No grades released yet.
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {grades.slice(0, 5).map((g) => {
                    const itemPct = pct(g.score, g.outOf);
                    const linkedTitle =
                      g.testSubmission?.test.title ?? g.submissionEntry?.submission.title ?? g.title;
                    const href = g.testSubmission
                      ? `/dashboard/tests/review/${g.testSubmission.test.id}`
                      : g.submissionEntry
                        ? `/dashboard/submissions/${g.submissionEntry.submission.id}`
                        : null;
                    const Row = (
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                          <GraduationCap className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-medium text-foreground">{linkedTitle}</p>
                          <p className="text-muted-foreground truncate text-xs">{g.type}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={itemPct >= 50 ? "soft" : "secondary"} className="tabular-nums">
                            {itemPct}%
                          </Badge>
                          <span className="font-display tabular-nums text-foreground text-sm">
                            {g.score}<span className="text-muted-foreground"> / {g.outOf}</span>
                          </span>
                        </div>
                      </div>
                    );
                    return (
                      <li key={g.id}>
                        {href ? <Link href={href} className="hover:bg-muted/40 block transition-colors">{Row}</Link> : Row}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-primary-foreground/8 backdrop-blur-sm rounded-lg p-3 border border-primary-foreground/15">
      <p className="text-primary-foreground/70 text-xs flex items-center gap-1.5">
        <Hourglass className="size-3" />
        {label}
      </p>
      <p className="font-display mt-1 text-xl tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">{title}</h2>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
        <Link href={href}>
          {label}
          <ArrowRight className="size-3" />
        </Link>
      </Button>
    </div>
  );
}
