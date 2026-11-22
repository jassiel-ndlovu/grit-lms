/**
 * /dashboard/manage-courses/[id]/settings — the course's details and
 * enrolment (cover image, name, description, students). CourseForm is a
 * client component that calls the updateCourse server action. Below it,
 * each student's extra time on timed tests (ExtraTimeCard, decision 7).
 * Workspace courses also get the "List this course" switch (#206), which
 * lets students and parents find it and ask to join.
 */

import { Card } from "@/components/ui/card";
import { listExtraTime } from "@/features/assessments/accommodations";
import { ExtraTimeCard } from "@/features/assessments/components/extra-time-card";
import { extraTimeToChoice } from "@/features/assessments/lib/extra-time";
import { CourseFrame } from "@/features/courses/components/course-frame";
import { CourseForm } from "@/features/courses/components/course-form";
import { CourseListingSwitch } from "@/features/courses/components/join-requests";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { listWorkspaceStudents } from "@/features/students/queries";
import { LEGACY_WORKSPACE_ID } from "@/features/workspaces/tenancy";
import { prisma } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Course settings" };

export default async function ManageCourseSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) return <div className="text-muted-foreground p-8 text-sm">{loaded.message}</div>;
  const { course } = loaded;
  // Same rule as A's setCourseEnrollment: no workspace means the legacy one.
  const students = await listWorkspaceStudents(course.workspaceId ?? LEGACY_WORKSPACE_ID);
  const [extraTime, listing, pendingRequests] = await Promise.all([
    listExtraTime(course.id),
    prisma.courseListing.findUnique({ where: { courseId: course.id }, select: { courseId: true } }),
    prisma.joinRequest.count({ where: { courseId: course.id, status: "PENDING" } }),
  ]);
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
        {course.workspaceId ? (
          <Card className="p-6">
            <CourseListingSwitch courseId={course.id} listed={listing != null} pending={pendingRequests} />
          </Card>
        ) : null}
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
