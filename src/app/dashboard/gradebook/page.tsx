/**
 * /dashboard/gradebook — tutor picks a course.
 *
 * Server Component. Tutor-only; students keep using /dashboard/grades.
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";

import { listGradebookCoursesForTutor } from "@/features/grades/gradebook";

export const metadata = { title: "Gradebook" };

export default async function GradebookIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard/grades");

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

  const courses = await listGradebookCoursesForTutor(tutor.id);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          Gradebook
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Weighted marks per course, for the class and for each student.
        </p>
      </header>

      {courses.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="text-muted-foreground mx-auto size-10" />
          <h2 className="font-display mt-3 text-lg text-foreground">
            No courses yet
          </h2>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
            Create a course and its assessments, and the gradebook fills in
            as you grade.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/gradebook/${c.id}`} className="block">
                <Card className="hover:border-brand-terracotta/40 flex items-center gap-4 p-5 transition-colors">
                  <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
                    {c.imageUrl ? (
                      <Image
                        src={c.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <BookOpen className="text-muted-foreground absolute inset-0 m-auto size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {c.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {c._count.students}
                      </span>
                      <span className="tabular-nums">
                        {c._count.tests + c._count.submissions} assessments
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
