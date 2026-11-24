/**
 * /dashboard/courses/[id]/practice — a student's practice sets on a course
 * (contracts/practice.md), with what is due today.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { hasPractice, listPracticeForStudent } from "@/features/assessments/practice-queries";
import { StudentCourseFrame, studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { enrolledStudent } from "@/features/courses/lib/tenancy-where";
import { auth } from "@/lib/auth";
import { schoolDateFormat } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const metadata = { title: "Practice" };

const dateFmt = schoolDateFormat({ weekday: "short", day: "numeric", month: "short" });

export default async function StudentPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!student) {
    return (
      <PageMessage breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: "Practice" }]}>
        This page is for students, and this account isn&apos;t set up as one. If you&apos;re a student, ask your tutor or school to check it.
      </PageMessage>
    );
  }
  const course = await prisma.course.findFirst({
    where: { id: courseId, ...enrolledStudent(student.id) },
    select: { id: true, name: true },
  });
  if (!course || !(await hasPractice(course.id))) notFound();
  const sets = await listPracticeForStudent(course.id, student.id, new Date());

  return (
    <StudentCourseFrame course={course} page="Practice">
      <PageTitle
        title="Practice"
        description="Answer at your own pace and see the answer straight away. Questions you miss come back sooner. Nothing here counts for marks."
      />
      {sets.length === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="empty-tests" />}
          title="Nothing to practise yet"
          description="When your tutor adds practice questions, they show here."
        />
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {sets.map(({ id, title, description, summary: s }) => {
            const ready = s.due + s.fresh;
            return (
              <li key={id}>
                <Link
                  href={studentCourseRoutes.practice(course.id, id)}
                  className="hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3 transition-colors"
                >
                  <span className="min-w-0 flex-1 basis-56 space-y-0.5">
                    <span className="text-foreground block truncate text-sm font-medium">{title}</span>
                    {description ? <span className="text-muted-foreground block text-xs">{description}</span> : null}
                    <span className="text-muted-foreground block text-xs">
                      {s.known} of {s.questions} known
                      {s.answered ? ` · ${s.answered} practised` : ""}
                      {ready === 0 && s.nextDue ? ` · next one ${dateFmt.format(s.nextDue)}` : ""}
                    </span>
                  </span>
                  {s.due ? <StatusChip tone="warning">{s.due} due</StatusChip> : null}
                  {s.fresh ? <StatusChip tone="info">{s.fresh} new</StatusChip> : null}
                  {ready === 0 ? <StatusChip tone="success">All caught up</StatusChip> : null}
                  <ArrowRight aria-hidden className="text-muted-foreground size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </StudentCourseFrame>
  );
}
