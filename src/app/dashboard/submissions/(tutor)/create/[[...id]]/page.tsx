/**
 * /dashboard/submissions/create/[[id]] — tutor creates or edits an
 * assignment (legacy Batch 3b, design 07).
 *
 * Server Component: reads the viewer, the tutor's courses and, when
 * editing, the assignment, then hands plain values to AssignmentForm (a
 * client form that saves through createSubmission / updateSubmission and
 * uploads briefs as BlobKind.AssignmentBrief). This replaces the
 * context-backed page; nothing here reads a React context.
 */

import { notFound, redirect } from "next/navigation";

import { AssignmentForm, type AssignmentFormValues } from "@/features/submissions/components/assignment-form";
import { listCoursesByTutorId } from "@/features/courses/queries";
import { getSubmissionDetailById, submissionBelongsToTutor } from "@/features/submissions/queries";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

export const metadata = { title: "Assignment" };

export default async function AssignmentEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const { id: segments } = await params;
  const id = segments?.[0];

  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!can(viewer, "courses.edit")) redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({ where: { email: viewer.user.email }, select: { id: true } });
  if (!tutor) {
    return <div className="text-muted-foreground p-8 text-sm">No tutor profile found for this account.</div>;
  }

  const [courses, submission] = await Promise.all([
    listCoursesByTutorId(tutor.id),
    id ? getSubmissionDetailById(id) : Promise.resolve(null),
  ]);
  if (id && (!submission || !(await submissionBelongsToTutor(id, tutor.id)))) notFound();

  const initial: AssignmentFormValues | null = submission
    ? {
        title: submission.title,
        description: submission.description,
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
