/** /dashboard/assignments/new — a tutor sets a new assignment. */

import { AssignmentEditorPage } from "@/features/assignments/components/assignment-editor-page";

export const metadata = { title: "New assignment" };

export default function NewAssignmentPage() {
  return <AssignmentEditorPage />;
}
