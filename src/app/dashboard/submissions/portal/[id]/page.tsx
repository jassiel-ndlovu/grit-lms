/**
 * Retired legacy page (design 07, Batch 3). The student hand-in portal now lives on
 * /dashboard/submissions/[id], which serves tutors and students; old links
 * redirect there for at least one release.
 */

import { redirect } from "next/navigation";

export default async function LegacySubmissionPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/submissions/${encodeURIComponent(id)}`);
}
