/**
 * /dashboard/admin/support: Nexa's own inbox (support.md). Nexa admins only.
 */

import { notFound, redirect } from "next/navigation";

import { InboxView } from "@/features/support/components/inbox-view";
import { supportRoutes } from "@/features/support/support-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Support inbox" };

export default async function NexaInboxPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${encodeURIComponent(supportRoutes.nexaInbox)}`);
  if (viewer.persona !== "admin") notFound();
  const { status } = await searchParams;
  return <InboxView viewer={viewer} route="NEXA" status={status} basePath={supportRoutes.nexaInbox} />;
}
