/**
 * /dashboard — top-level landing.
 *
 * Server Component that branches on role:
 *   - STUDENT: editorial home with progress, up-next deadlines, recent grades
 *   - TUTOR: quick-link tiles into the tutor management surfaces
 *
 * Replaces the legacy client /dashboard/home/* split. All data comes from
 * feature queries.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Hourglass,
  Pencil,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { listCoursesByStudentId } from "@/features/courses/queries";
import {
  listCompletionsForStudentInCourse,
  listLessonsByCourseId,
} from "@/features/lessons/queries";
import {
  getTestSubmissionByStudentAndTest,
  listActiveTestsForStudent,
} from "@/features/assessments/queries";
import {
  getEntryByStudentAndSubmission,
  listActiveSubmissionsForStudent,
} from "@/features/submissions/queries";
import { listGradesForStudent } from "@/features/grades/queries";
import { listUpcomingEventsForStudent } from "@/features/events/queries";

export const metadata = { title: "Dashboard" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function pct(score: number, outOf: number) {
  if (outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}

export default async function DashboardLanding() {
  const session = await auth();
  if (!session?.user) redirect("/");

  if (session.user.role === "TUTOR") {
    return <TutorDashboard />;
  }

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

  const [courses, tests, assignments, grades, events] = await Promise.all([
    listCoursesByStudentId(student.id),
    listActiveTestsForStudent(student.id),
    listActiveSubmissionsForStudent(student.id),
    listGradesForStudent(student.id),
    listUpcomingEventsForStudent(student.id),
  ]);

  const progressByCourse = await Promise.all(
    courses.map(async (c) => {
      const [lessons, completions] = await Promise.all([
        listLessonsByCourseId(c.id),
        listCompletionsForStudentInCourse(student.id, c.id),
      ]);
      const total = lessons.length;
      const done = completions.length;
      return {
        course: c,
        total,
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    }),
  );

  const completedLessons = progressByCourse.reduce((s, p) => s + p.done, 0);
  const totalLessons = progressByCourse.reduce((s, p) => s + p.total, 0);
  const averageProgress =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const totalScore = grades.reduce((s, g) => s + g.score, 0);
  const totalOutOf = grades.reduce((s, g) => s + g.outOf, 0);
  const overall = totalOutOf > 0 ? pct(totalScore, totalOutOf) : null;

  const testStatuses = await Promise.all(
    tests.map((t) => getTestSubmissionByStudentAndTest(student.id, t.id)),
  );
  const pendingTests = tests
    .map((t, i) => ({ test: t, sub: testStatuses[i] }))
    .filter(({ sub }) => !sub || sub.status === "IN_PROGRESS")
    .map(({ test }) => ({
      kind: "test" as const,
      id: test.id,
      title: test.title,
      course: test.course.name,
      date: test.dueDate,
      href: `/dashboard/tests/${test.id}`,
    }));

  const entryStatuses = await Promise.all(
    assignments.map((a) => getEntryByStudentAndSubmission(student.id, a.id)),
  );
  const pendingAssignments = assignments
    .map((a, i) => ({ assignment: a, entry: entryStatuses[i] }))
    .filter(
      ({ entry }) =>
        !entry || (entry.status !== "GRADED" && entry.status !== "SUBMITTED"),
    )
    .map(({ assignment }) => ({
      kind: "assignment" as const,
      id: assignment.id,
      title: assignment.title,
      course: assignment.course.name,
      date: assignment.dueDate,
      href: `/dashboard/submissions/${assignment.id}`,
    }));

  const eventRows = events.map((e) => ({
    kind: "event" as const,
    id: e.id,
    title: e.title,
    course: e.course.name,
    date: e.date,
    href: `/dashboard/calendar`,
  }));

  const upNext = [...pendingTests, ...pendingAssignments, ...eventRows]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  const recentGrades = grades.slice(0, 4);
  const firstName = student.fullName.split(" ")[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground rounded-lg overflow-hidden">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-primary-foreground/70 text-sm">
              {greeting}, {firstName}.
            </p>
            <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
              Welcome back to your studies.
            </h1>
            <p className="text-primary-foreground/70 mt-3 max-w-xl text-sm">
              {courses.length === 0
                ? "Browse the catalogue to enrol in your first course."
                : `${courses.length} ${courses.length === 1 ? "course" : "courses"} in motion. ${completedLessons} ${completedLessons === 1 ? "lesson" : "lessons"} completed.`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:grid-cols-3 md:gap-6">
            <HeroStat icon={<TrendingUp className="size-4" />} label="Progress" value={`${averageProgress}%`} />
            <HeroStat icon={<Target className="size-4" />} label="Up next" value={String(upNext.length)} />
            <HeroStat icon={<GraduationCap className="size-4" />} label="Average" value={overall != null ? `${overall}%` : "-"} />
          </div>
        </div>
      </section>

      {progressByCourse.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Continue learning" href="/dashboard/courses" label="All courses" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {progressByCourse.slice(0, 6).map(({ course, percent, done, total }) => (
              <Card key={course.id} className="group flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
                <Link href={`/dashboard/courses/${course.id}`} className="flex flex-1 flex-col gap-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">{course.tutor.fullName ?? "Course"}</p>
                    <h3 className="font-display line-clamp-2 text-lg leading-tight tracking-tight text-foreground">{course.name}</h3>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="size-3" />
                      {course._count.lessons} lessons
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {course._count.students} students
                    </span>
                  </div>
                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium tabular-nums">{done}/{total}</span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div className="bg-brand-terracotta h-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader title="Up next" href="/dashboard/calendar" label="View schedule" />
          <Card className="overflow-hidden p-0">
            {upNext.length === 0 ? (
              <div className="text-muted-foreground p-12 text-center text-sm">Nothing pending. Take a deep breath.</div>
            ) : (
              <ul className="divide-border divide-y">
                {upNext.map((item) => {
                  const Icon = item.kind === "test" ? Pencil : item.kind === "assignment" ? Hourglass : CalendarDays;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link href={item.href} className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors">
                        <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {item.course} - {item.kind === "test" ? "Test" : item.kind === "assignment" ? "Assignment" : "Event"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">{dateFmt.format(item.date)}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Recent grades" href="/dashboard/grades" label="All grades" />
          <Card className="overflow-hidden p-0">
            {recentGrades.length === 0 ? (
              <div className="text-muted-foreground p-12 text-center text-sm">No grades released yet.</div>
            ) : (
              <ul className="divide-border divide-y">
                {recentGrades.map((g) => {
                  const itemPct = pct(g.score, g.outOf);
                  const linkedTitle = g.testSubmission?.test.title ?? g.submissionEntry?.submission.title ?? g.title;
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
                        <p className="text-muted-foreground truncate text-xs">{g.course.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={itemPct >= 50 ? "soft" : "secondary"} className="tabular-nums">{itemPct}%</Badge>
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
  );
}

function HeroStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-primary-foreground/8 backdrop-blur-sm rounded-lg p-3 border border-primary-foreground/15">
      <div className="text-primary-foreground/70 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <p className="font-display mt-1 text-2xl tabular-nums">{value}</p>
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

function TutorDashboard() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">Welcome back, tutor.</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Manage your courses, schedule, and assessments from one place.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-6">
          <Link href="/dashboard/manage-courses" className="block space-y-2">
            <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 items-center justify-center rounded-md"><BookOpen className="size-5" /></div>
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">Manage courses</h2>
            <p className="text-muted-foreground text-sm">Edit content, manage enrolment, and add lessons.</p>
          </Link>
        </Card>
        <Card className="p-6">
          <Link href="/dashboard/calendar" className="block space-y-2">
            <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 items-center justify-center rounded-md"><CalendarDays className="size-5" /></div>
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">Schedule</h2>
            <p className="text-muted-foreground text-sm">Lectures, exams, and meetings across your courses.</p>
          </Link>
        </Card>
        <Card className="p-6">
          <Link href="/dashboard/submissions" className="block space-y-2">
            <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 items-center justify-center rounded-md"><Pencil className="size-5" /></div>
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">Assignments</h2>
            <p className="text-muted-foreground text-sm">Review and grade student submissions.</p>
          </Link>
        </Card>
        <Card className="p-6">
          <Link href="/dashboard/tutor-tests" className="block space-y-2">
            <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 items-center justify-center rounded-md"><Target className="size-5" /></div>
            <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">Tests &amp; quizzes</h2>
            <p className="text-muted-foreground text-sm">Author assessments and review submissions.</p>
          </Link>
        </Card>
      </div>
    </div>
  );
}
