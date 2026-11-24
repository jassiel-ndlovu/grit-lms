/**
 * /dashboard/support: the organisation's inbox of queries from its students
 * and parents (support.md). Staff with "Handle enquiries" see those in their
 * scope; tutors see those about their own courses.
 */

import { redirect } from "next/navigation";

import { InboxView } from "@/features/support/components/inbox-view";
import { supportRoutes } from "@/features/support/support-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Queries" };

export default async function OrganisationInboxPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${encodeURIComponent(supportRoutes.organisationInbox)}`);
  const { status } = await searchParams;
  return <InboxView viewer={viewer} route="WORKSPACE" status={status} basePath={supportRoutes.organisationInbox} />;
}
