/**
 * /dashboard/manage-courses/[id]/settings — the course's details and
 * enrolment (cover image, name, description, students). CourseForm is a
 * client component that calls the updateCourse server action. Below it,
 * each student's extra time on timed tests (ExtraTimeCard, decision 7).
 */

import { Card } from "@/components/ui/card";
import { listExtraTime } from "@/features/assessments/accommodations";
import { ExtraTimeCard } from "@/features/assessments/components/extra-time-card";
import { extraTimeToChoice } from "@/features/assessments/lib/extra-time";
import { CourseFrame } from "@/features/courses/components/course-frame";
import { CourseForm } from "@/features/courses/components/course-form";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { listAllStudents } from "@/features/students/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Course settings" };

export default async function ManageCourseSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const [loaded, students] = await Promise.all([loadTutorCourse(id), listAllStudents()]);
  if (!loaded.ok) return <div className="text-muted-foreground p-8 text-sm">{loaded.message}</div>;
  const { course } = loaded;
  const extraTime = await listExtraTime(course.id);
  const extraTimeInitial = Object.fromEntries(course.students.map((s) => [s.id, extraTimeToChoice(extraTime.get(s.id))]));

  return (
    <CourseFrame course={course} page="Settings">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">Settings</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Cover image, name, description, enrolled students and extra time.</p>
        </div>
        <Card className="p-6">
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
        <Card className="p-6">
          <ExtraTimeCard
            courseId={course.id}
            students={course.students.map((s) => ({ id: s.id, name: s.fullName || s.email }))}
            initial={extraTimeInitial}
          />
        </Card>
      </div>
    </CourseFrame>
  );
}
