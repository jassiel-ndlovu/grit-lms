/**
 * /dashboard/manage-courses/[id] — the tutor's course overview (UI draft
 * "Course page"): the course's properties, its lesson outline, and its
 * tests and assignments.
 *
 * Lessons are edited on the Lessons view and the course details and
 * enrolment on Settings (`./settings`); CourseFrame links all three.
 */

import { prisma } from "@/lib/db";
import { CourseOverview } from "@/features/courses/components/course-overview";
import { lessonSummary, sortWork, type WorkItem } from "@/features/courses/lib/course-overview";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { otherTeacherName } from "@/features/courses/lib/course-access";
import { describeRecurrence, occurrencesOf } from "@/features/events/lib/recurrence";
import { buildLessonTree, flattenLessonTree } from "@/features/lessons/lib/lesson-tree";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Course" };

const DAY = 24 * 60 * 60 * 1000;

export default async function ManageCourseOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) return <div className="text-muted-foreground p-8 text-sm">{loaded.message}</div>;
  const { course, userId } = loaded;

  const [prefs, assignments] = await Promise.all([
    getUserPreferences(userId),
    prisma.submission.findMany({
      where: { courseId: id },
      select: { id: true, title: true, dueDate: true, isActive: true },
    }),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const now = new Date();

  // Lesson outline, numbered with the course's own scheme.
  const outline = flattenLessonTree(buildLessonTree(course.lessons), course.lessonLabelScheme);

  // Tests and assignments, open first.
  const work = sortWork<WorkItem>(
    [
      ...course.tests.map((t) => ({ kind: "test" as const, id: t.id, title: t.title, dueDate: t.dueDate, isActive: t.isActive })),
      ...assignments.map((a) => ({ kind: "assignment" as const, ...a })),
    ],
    now,
  );

  // Schedule: the repeating series still running, and the next session.
  const time = (d: Date) => formatDate(d, ctx, { hour: "2-digit", minute: "2-digit" });
  const schedule = [
    ...new Set(
      course.courseEvents
        .filter((e) => !e.repeatUntil || e.repeatUntil >= now)
        .map((e) => {
          const rule = describeRecurrence(e);
          return rule ? `${rule}, ${time(e.date)}` : null;
        })
        .filter((s): s is string => s !== null),
    ),
  ];
  const next = course.courseEvents
    .flatMap((e) => occurrencesOf(e, now, new Date(now.getTime() + 60 * DAY), ctx.timeZone).map((date) => ({ title: e.title, date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const tests = course.tests.length;
  const props: [string, React.ReactNode][] = [];
  // An owner or admin looking at a tutor's course (#192): say who teaches it.
  const teacher = otherTeacherName(userId, course);
  if (teacher) props.push(["Taught by", teacher]);
  props.push(
    ["Students", `${course.students.length} enrolled`],
    ["Lessons", lessonSummary(course.lessons)],
    [
      "Assessments",
      `${tests} test${tests === 1 ? "" : "s"} · ${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`,
    ],
  );
  if (schedule.length) props.push(["Schedule", schedule.slice(0, 2).join("; ")]);
  props.push([
    "Next session",
    next ? `${formatDate(next.date, ctx, { weekday: "short", day: "numeric", month: "short" })}, ${time(next.date)} · ${next.title}` : "None in the next 60 days",
  ]);

  return <CourseOverview course={course} props={props} outline={outline} work={work} ctx={ctx} />;
}
