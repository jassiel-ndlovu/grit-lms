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
import { PageMessage, PageTitle } from "@/components/shell/page-frame";
import { CourseFrame, courseRoutes } from "@/features/courses/components/course-frame";
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
  if (!loaded.ok) return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Settings" }]}>{loaded.message}</PageMessage>;
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
    <CourseFrame course={course} page="Settings" type="settings">
      <PageTitle title="Settings" description="Cover image, name, description, curriculum, enrolled students and extra time." />
      <Card className="p-6">
        <CourseForm
          students={students}
          defaultValues={{
            id: course.id,
            name: course.name,
            description: course.description,
            imageUrl: course.imageUrl,
            studentIds: course.students.map((s) => s.id),
            curriculum: { curriculum: course.curriculum, subject: course.subject, gradeLevel: course.gradeLevel },
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
    </CourseFrame>
  );
}
