/**
 * /dashboard/courses/[id]/topics — a learner's topic map for one course
 * (owner, 24 Nov): lessons finished, questions marked and topics passed.
 * Same gate as the course page: enrolled learners, their own released marks.
 */

import { notFound, redirect } from "next/navigation";

import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StudentCourseFrame, studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { TopicMap } from "@/features/courses/components/topic-map";
import { curriculumLabel } from "@/features/courses/lib/curriculum";
import { TOPIC_PASS, topicCounts } from "@/features/courses/lib/topic-map";
import { getCourseDetailById } from "@/features/courses/queries";
import { learnerTopicMap } from "@/features/courses/topic-map";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Topics" };

export default async function CourseTopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const crumbs = [{ label: "My courses", href: studentCourseRoutes.list }, { label: "Topics" }];
  const student = await prisma.student.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!student) return <PageMessage breadcrumb={crumbs}>No student profile found for this account.</PageMessage>;
  const course = await getCourseDetailById(courseId);
  if (!course) notFound();
  if (!course.students.some((s) => s.id === student.id)) {
    return <PageMessage breadcrumb={crumbs}>You aren&apos;t enrolled in this course.</PageMessage>;
  }

  const { nodes, nextLesson } = await learnerTopicMap(student.id, courseId);
  if (nodes.length === 0) {
    return (
      <StudentCourseFrame course={course} page="Topics">
        <PageTitle title="Topics" description="Your tutor hasn't set this course's curriculum yet, so there are no topics to show." />
      </StudentCourseFrame>
    );
  }

  const c = topicCounts(nodes);
  const hrefs = Object.fromEntries(
    nodes.map((n) => [n.code, nextLesson[n.code] ? studentCourseRoutes.lessons(courseId, nextLesson[n.code]) : undefined]),
  );
  return (
    <StudentCourseFrame course={course} page="Topics">
      <PageTitle
        title="Topics"
        description={`${curriculumLabel(course)}. A topic is passed at ${TOPIC_PASS}% or more on its marked questions. Open a topic to carry on with its lessons.`}
        properties={
          <div className="flex max-w-md items-center gap-3">
            <ProgressBar label="Topics passed" value={c.passed} max={c.total} valueText={`${c.passed} of ${c.total} passed`} tone="success" />
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {c.passed} of {c.total} passed
            </span>
          </div>
        }
      />
      <TopicMap nodes={nodes} hrefs={hrefs} labels={{ none: "Not started", started: "Started", passed: "Passed" }} />
    </StudentCourseFrame>
  );
}
