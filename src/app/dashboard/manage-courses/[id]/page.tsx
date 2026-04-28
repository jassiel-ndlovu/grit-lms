/**
 * /dashboard/manage-courses/[id] — tutor's edit page for a single course.
 *
 * Server Component shell. The course-info edit form (CourseForm) is a
 * Client Component that calls the updateCourse Server Action.
 *
 * The links to "Manage Lessons" and "Manage Assessments" still point at
 * the legacy pages — those features migrate in subsequent chapters.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpenText, FileText, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  courseBelongsToTutor,
  getCourseDetailById,
} from "@/features/courses/queries";
import { listAllStudents } from "@/features/students/queries";
import { CourseForm } from "@/features/courses/components/course-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Edit course" };

export default async function ManageCourseDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

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

  const [course, students, owns] = await Promise.all([
    getCourseDetailById(id),
    listAllStudents(),
    courseBelongsToTutor(id, tutor.id),
  ]);

  if (!course) notFound();
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this course.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          {course.name}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Edit course details, manage enrolment, and link to lessons and
          assessments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Users className="size-4" />}
          label="Students"
          value={course.students.length}
        />
        <StatTile
          icon={<BookOpenText className="size-4" />}
          label="Lessons"
          value={course.lessons.length}
        />
        <StatTile
          icon={<FileText className="size-4" />}
          label="Assessments"
          value={course.quizzes.length + course.tests.length}
        />
      </div>

      <Card className="space-y-6 p-6">
        <div>
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Course details
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Cover image, name, description, and enrolled students.
          </p>
        </div>
        <Separator />
        <CourseForm
          students={students}
          defaultValues={{
            id: course.id,
            name: course.name,
            description: course.description,
            imageUrl: course.imageUrl,
            studentIds: course.students.map((s) => s.id),
          }}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
          Course content
        </h2>
        <p className="text-muted-foreground text-sm">
          Lessons and assessments are managed on dedicated pages.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/dashboard/manage-courses/lessons/${course.id}`}>
              <BookOpenText className="size-4" /> Manage lessons
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/tutor-tests">
              <FileText className="size-4" /> Manage assessments
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-4">
      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md">
        {icon}
      </div>
      <div>
        <p className="font-display text-2xl tabular-nums text-foreground">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </Card>
  );
}
