/** /dashboard/assignments/[id]/edit — a tutor edits an assignment they set. */

import { AssignmentEditorPage } from "@/features/assignments/components/assignment-editor-page";

export const metadata = { title: "Edit assignment" };

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentEditorPage id={id} />;
}
