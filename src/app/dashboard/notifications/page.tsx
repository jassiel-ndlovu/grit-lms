/**
 * /dashboard/notifications — notifications page for every role.
 *
 * Server Component shell that renders the full list. Each row is an
 * interactive Client component (NotificationListItem) so per-row
 * mark-read / mark-unread toggles work without hydrating the page header.
 *
 * Filtering by unread is driven by `?unread=1` so the URL is shareable
 * and the filter survives a refresh. The "Show unread only" toggle is a
 * plain `<Link>`, no client state.
 *
 * Note: the legacy page also rendered an Activity tab. That migration is
 * deferred to a follow-up chapter — this page focuses on notifications.
 */

import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { auth } from "@/lib/auth";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getNotificationViewer,
  getUnreadCount,
  listNotifications,
} from "@/features/notifications/queries";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NotificationListItem } from "@/features/notifications/components/notification-list-item";
import { NotificationsEmpty } from "@/features/notifications/components/notifications-empty";

interface PageProps {
  searchParams: Promise<{ unread?: string }>;
}

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps) {
  const { unread } = await searchParams;
  const unreadOnly = unread === "1";

  const session = await auth();
  if (!session?.user) redirect("/");
  const viewer = await getNotificationViewer(session.user);
  const [items, unreadCount] = await Promise.all([
    listNotifications(viewer, { unreadOnly }),
    getUnreadCount(viewer),
  ]);
  const subtitle =
    session.user.role === "TUTOR"
      ? "Student submissions, grading reminders and course activity."
      : "Activity from your courses, tutors, and submissions.";

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Notifications" }]}
      status={unreadCount > 0 ? <StatusChip tone="info">{unreadCount} unread</StatusChip> : undefined}
      actions={<MarkAllReadButton hasUnread={unreadCount > 0} />}
      secondary={
        <RibbonNav
          label="Show"
          current={unreadOnly ? "/dashboard/notifications?unread=1" : "/dashboard/notifications"}
          links={[
            { label: "All", href: "/dashboard/notifications" },
            { label: "Unread only", href: "/dashboard/notifications?unread=1" },
          ]}
        />
      }
    >
      <PageTitle icon={<Bell />} title="Notifications" description={subtitle} />

      {items.length === 0 ? (
        <NotificationsEmpty unreadOnly={unreadOnly} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 px-4 py-3">
            <Bell className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">
              {items.length} {items.length === 1 ? "notification" : "notifications"}
            </span>
          </div>
          <Separator />
          <ul className="divide-border divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationListItem notification={n} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageFrame>
  );
}
