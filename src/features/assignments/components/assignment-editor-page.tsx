/**
 * The assignment editor behind /dashboard/assignments/new and
 * /dashboard/assignments/[id]/edit (legacy Batch 3b, design 07).
 *
 * Server Component: reads the viewer, the tutor's courses and, when
 * editing, the assignment, then hands plain values to AssignmentForm (a
 * client form that saves through createSubmission / updateSubmission and
 * uploads briefs as BlobKind.AssignmentBrief). This replaces the
 * context-backed page; nothing here reads a React context.
 */

import { notFound, redirect } from "next/navigation";

import "server-only";

import { AssignmentForm, type AssignmentFormValues } from "@/features/assignments/components/assignment-form";
import { listCoursesByTutorId } from "@/features/courses/queries";
import { getSubmissionDetailById, submissionBelongsToTutor } from "@/features/assignments/queries";
import { getViewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";
import { getCourseScope } from "@/features/courses/course-access";

/** `id` edits that assignment; without one, a new assignment. */
export async function AssignmentEditorPage({ id }: { id?: string }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!can(viewer, "courses.edit")) redirect("/dashboard");

  const scope = await getCourseScope(viewer.user.id);

  const [courses, submission] = await Promise.all([
    listCoursesByTutorId(scope),
    id ? getSubmissionDetailById(id) : Promise.resolve(null),
  ]);
  if (id && (!submission || !(await submissionBelongsToTutor(id, scope)))) notFound();

  const initial: AssignmentFormValues | null = submission
    ? {
        title: submission.title,
        description: submission.description,
        descriptionJson: submission.descriptionJson,
        descriptionFiles: submission.descriptionFiles,
        courseId: submission.courseId,
        fileType: submission.fileType,
        dueDate: submission.dueDate,
        lastDueDate: submission.lastDueDate,
        maxAttempts: submission.maxAttempts,
        totalPoints: submission.totalPoints,
        isActive: submission.isActive ?? true,
      }
    : null;

  return (
    <AssignmentForm
      id={submission?.id ?? null}
      initial={initial}
      courses={courses.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
