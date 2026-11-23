/**
 * /dashboard/manage-courses/[id]/coverage — the curriculum coverage map
 * (#216, contracts/curriculum.md). Each topic of the course's curriculum,
 * with the lessons and test questions tagged with it and the marks those
 * questions are worth. Topics with no lessons or no questions are gaps.
 */

import Link from "next/link";
import { Settings } from "lucide-react";

import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { CourseFrame, courseRoutes } from "@/features/courses/components/course-frame";
import { coverage, curriculumLabel, topicsFor, type CoverageRow } from "@/features/courses/lib/curriculum";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { prisma } from "@/lib/db";

export const metadata = { title: "Coverage" };

function status(r: CoverageRow): { label: string; tone: StatusTone } {
  if (r.lessons && r.questions) return { label: "Covered", tone: "success" };
  if (r.lessons) return { label: "No questions", tone: "warning" };
  if (r.questions) return { label: "No lessons", tone: "warning" };
  return { label: "Not yet", tone: "neutral" };
}

export default async function CourseCoveragePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) {
    return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Coverage" }]}>{loaded.message}</PageMessage>;
  }
  const { course } = loaded;
  const topics = topicsFor(course);
  const label = curriculumLabel(course);

  if (topics.length === 0) {
    return (
      <CourseFrame course={course} page="Coverage">
        <PageTitle title="Coverage" description="Which curriculum topics your lessons and tests cover." />
        <div className="border-border space-y-3 rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            {course.curriculum === "OTHER"
              ? "Coverage works with CAPS and IEB subjects for now."
              : "Set the course's curriculum, subject and grade in Settings to see which topics are covered."}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={courseRoutes.settings(course.id)}>
              <Settings aria-hidden className="size-4" />
              Course settings
            </Link>
          </Button>
        </div>
      </CourseFrame>
    );
  }

  const [lessons, questions] = await Promise.all([
    prisma.lesson.findMany({
      where: { courseId: course.id, type: "CONTENT" },
      select: { id: true, title: true, topics: true },
      orderBy: { order: "asc" },
    }),
    prisma.testQuestion.findMany({
      where: { test: { courseId: course.id }, type: { not: "NONE" } },
      select: { topics: true, points: true, test: { select: { id: true, title: true } } },
    }),
  ]);
  const rows = coverage(topics, lessons, questions);
  const withLessons = rows.filter((r) => r.lessons > 0).length;
  const withQuestions = rows.filter((r) => r.questions > 0).length;
  const untagged = questions.filter((q) => q.topics.length === 0).length;

  return (
    <CourseFrame course={course} page="Coverage">
      <PageTitle
        title="Coverage"
        description={`${label}. ${withLessons} of ${rows.length} topics have lessons; ${withQuestions} have test questions.`}
      />
      {untagged > 0 ? (
        <p className="text-muted-foreground text-sm">
          {untagged === 1 ? "1 test question has" : `${untagged} test questions have`} no topic yet. Tag questions in the test
          designer, and lessons in the lesson editor.
        </p>
      ) : null}

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Topic
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Lessons
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Questions
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Marks
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => {
              const s = status(r);
              const lessonTitles = lessons.filter((l) => l.topics.includes(r.topic.code)).map((l) => l.title);
              const testTitles = [
                ...new Map(questions.filter((q) => q.topics.includes(r.topic.code)).map((q) => [q.test.id, q.test.title])).values(),
              ];
              const where = [...lessonTitles, ...testTitles];
              return (
                <tr key={r.topic.code} className="align-top">
                  <td className="px-3 py-2">
                    <span className="text-foreground font-medium">{r.topic.title}</span>
                    {where.length ? (
                      <span className="text-muted-foreground block text-xs [overflow-wrap:anywhere]">{where.join(" · ")}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lessons}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.questions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.marks}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusChip tone={s.tone}>{s.label}</StatusChip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CourseFrame>
  );
}
