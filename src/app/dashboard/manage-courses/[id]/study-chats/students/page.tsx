/**
 * /dashboard/manage-courses/[id]/study-chats/students — the study
 * assistant's switch for each student on the course (owner, 24 Nov). For
 * staff who may edit the course; a 404 without the service.
 */

import { notFound, redirect } from "next/navigation";

import { PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { StudyChatsFrame } from "@/features/courses/components/study/staff-frame";
import { StudentSwitches } from "@/features/courses/components/study/student-switches";
import { hasStudyAssistant, orNotFound, studyCourse } from "@/features/courses/study";
import { studentSwitches } from "@/features/courses/study-switch";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Study assistant for each student" };

export default async function StudySwitchesPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { id } = await params;
  const course = await studyCourse(id);
  if (!course) notFound();
  const rows = await orNotFound(() => studentSwitches(viewer, id));
  if (!(await hasStudyAssistant(id))) notFound();

  return (
    <StudyChatsFrame course={course} chat="Students" editor>
      <PageTitle
        title="Study assistant for each student"
        description="A student who is switched off can't ask anything new on this course. They can still read their earlier chats. They and their parents see that it's off."
      />
      {rows.length === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="inbox-empty" />}
          title="No students yet"
          description="When students join the course, they show here with a switch each."
        />
      ) : (
        <StudentSwitches courseId={id} rows={rows} />
      )}
    </StudyChatsFrame>
  );
}
