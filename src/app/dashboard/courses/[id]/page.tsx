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
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  GraduationCap,
  Pencil,
  Target,
  TrendingUp,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tutorOf } from "@/features/courses/lib/tenancy-where";
import { courseCoverSrc } from "@/features/courses/lib/stock-covers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { StudentCourseFrame, studentCourseRoutes } from "@/features/courses/components/student-course-frame";

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
} from "@/features/assignments/queries";
import { listGradesForStudentInCourse } from "@/features/grades/queries";
import { listEventsByCourseId } from "@/features/events/queries";
import { buildLessonTree, flattenLessonTree } from "@/features/lessons/lib/lesson-tree";
import { assignmentRoutes } from "@/features/assignments/routes";
import { EmptyState, Scene } from "@/components/ui/empty-state";

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
    return <PageMessage breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: "Course" }]}>No student profile found for this account.</PageMessage>;
  }

  const course = await getCourseDetailById(courseId);
  if (!course) notFound();

  // Enrolment gate.
  const enrolled = course.students.some((s) => s.id === student.id);
  if (!enrolled) {
    return (
      <PageMessage breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: course.name }]}>
        You aren&apos;t enrolled in this course.
      </PageMessage>
    );
  }

  // Pull every section in parallel.
  const [allLessons, completions, tests, assignments, events, grades] = await Promise.all([
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

  // Reading order follows the lesson tree; group headings (NONE) have no
  // content, so they don't count towards progress or the preview list.
  const lessons = flattenLessonTree(buildLessonTree(allLessons), course.lessonLabelScheme)
    .filter((f) => f.lesson.type !== "NONE")
    .map((f) => ({ ...f.lesson, label: f.label }));

  const completedIds = new Set(completions.map((c) => c.lessonId));
  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;
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
    <StudentCourseFrame
      course={course}
      actions={
        nextLesson ? (
          <Button asChild variant="brand" size="sm" className="max-w-[16rem]">
            <Link href={studentCourseRoutes.lessons(courseId, nextLesson.id)}>
              {/* Long lesson titles truncate instead of pushing the button
                  past the edge of a phone screen. */}
              <span className="truncate">Continue with {nextLesson.title}</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      <PageTitle
        eyebrow={`with ${tutorOf(course)?.fullName ?? "your tutor"}`}
        title={course.name}
        description={course.description}
        illustration={
          <div className="border-border relative aspect-video w-40 overflow-hidden rounded-lg border">
            <Image src={courseCoverSrc(course)} alt="" fill sizes="160px" className="object-cover" />
          </div>
        }
        properties={
          <div className="space-y-4">
            <StatTiles>
              <StatTile icon={<BookOpen />} label="Lessons" value={`${completedCount}/${totalLessons}`} />
              <StatTile icon={<TrendingUp />} label="Progress" value={`${progressPct}%`} />
              <StatTile icon={<GraduationCap />} label="Average" value={courseAverage != null ? `${courseAverage}%` : "-"} />
              <StatTile icon={<Target />} label="Up next" value={String(pendingTests.length + pendingAssignments.length)} />
            </StatTiles>
            <div className="max-w-xl space-y-2">
              <div className="text-muted-foreground flex items-baseline justify-between text-xs">
                <span>Course progress</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div className="bg-brand-terracotta h-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        }
      />

      {/* Lessons preview */}
      <section className="space-y-4">
        <SectionHeader
          title="Lessons"
          href={`/dashboard/courses/lessons/${courseId}`}
          label="Open lessons"
        />
        {lessons.length === 0 ? (
          <Card className="p-0">
            <EmptyState compact illustration={<Scene name="empty-lessons" />} title="No lessons published yet" />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <ul className="divide-border divide-y">
              {lessons.slice(0, 6).map((lesson) => {
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
                        {done ? <CheckCircle2 className="size-4" /> : lesson.label}
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
          <SectionHeader title="Active assignments" href={assignmentRoutes.index} label="All assignments" />
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
                      href={assignmentRoutes.detail(assignment.id)}
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
              <EmptyState compact illustration={<Scene name="calendar-empty" />} title="No upcoming events" />
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
              <EmptyState compact illustration={<Scene name="nothing-to-grade" />} title="No grades released yet" />
            ) : (
              <ul className="divide-border divide-y">
                {grades.slice(0, 5).map((g) => {
                  const itemPct = pct(g.score, g.outOf);
                  const linkedTitle =
                    g.testSubmission?.test.title ?? g.submissionEntry?.submission.title ?? g.title;
                  const href = `/dashboard/grades/${g.id}`;
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
                      <Link href={href} className="hover:bg-muted/40 block transition-colors">{Row}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </StudentCourseFrame>
  );
}

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
        <Link href={href}>
          {label}
          <ArrowRight className="size-3" />
        </Link>
      </Button>
    </div>
  );
}
