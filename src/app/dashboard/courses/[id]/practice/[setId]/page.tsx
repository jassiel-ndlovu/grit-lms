/**
 * /dashboard/courses/[id]/practice/[setId] — a practice session. Due
 * questions first, then new ones; `?again=1` practises early when nothing
 * is due (the longest unseen first).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PracticeRunner } from "@/features/assessments/components/practice-runner";
import { SESSION_SIZE, buildQueue, practiceNodes, summarise } from "@/features/assessments/lib/practice";
import { readBankNode } from "@/features/assessments/lib/question-bank";
import { getPracticeForStudent, hasPractice } from "@/features/assessments/practice-queries";
import { StudentCourseFrame, studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { auth } from "@/lib/auth";
import { schoolDateFormat } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const metadata = { title: "Practice" };

const dateFmt = schoolDateFormat({ weekday: "long", day: "numeric", month: "long" });

export default async function PracticeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; setId: string }>;
  searchParams: Promise<{ again?: string }>;
}) {
  const [{ id: courseId, setId }, { again }] = await Promise.all([params, searchParams]);
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!student) notFound();
  const set = await getPracticeForStudent(setId, courseId, student.id);
  if (!set || !(await hasPractice(courseId))) notFound();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true, name: true } });

  const now = new Date();
  const reviews = set.items.flatMap((i) => i.reviews);
  const lastSeen = new Map(reviews.map((r) => [r.itemId, r.lastAnsweredAt.getTime()]));
  const queue = again
    ? [...set.items].sort((a, b) => (lastSeen.get(a.id) ?? 0) - (lastSeen.get(b.id) ?? 0) || a.order - b.order).slice(0, SESSION_SIZE)
    : buildQueue(set.items, reviews, now);
  const items = queue.flatMap((i) => {
    const node = readBankNode(i.data);
    return node ? [{ id: i.id, nodes: practiceNodes(node) }] : [];
  });
  const summary = summarise(set.items, reviews, now);
  const back = studentCourseRoutes.practice(course.id);

  return (
    <StudentCourseFrame course={course} page={set.title} parent={{ label: "Practice", href: back }} current={back}>
      <PageTitle title={set.title} description={set.description} />
      {items.length ? (
        <PracticeRunner setId={set.id} items={items} backHref={back} />
      ) : (
        <EmptyState
          compact
          illustration={<Scene name="nothing-to-grade" />}
          title="All caught up"
          description={
            summary.nextDue
              ? `The next question comes back on ${dateFmt.format(summary.nextDue)}.`
              : "There is nothing to practise in this set right now."
          }
          action={
            summary.answered ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${studentCourseRoutes.practice(course.id, set.id)}?again=1`}>
                  <RotateCcw aria-hidden className="size-4" />
                  Practise anyway
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </StudentCourseFrame>
  );
}
