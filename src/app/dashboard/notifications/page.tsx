/**
 * /dashboard/notifications — student notifications page.
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  getUnreadCountForStudent,
  listNotificationsForStudent,
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
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!student) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No student profile found for this account.
      </div>
    );
  }

  const [items, unreadCount] = await Promise.all([
    listNotificationsForStudent(student.id, { unreadOnly }),
    getUnreadCountForStudent(student.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Activity from your courses, tutors, and submissions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={unreadCount > 0 ? "soft" : "secondary"}>
              {unreadCount} unread
            </Badge>
            <MarkAllReadButton hasUnread={unreadCount > 0} />
          </div>
        </div>

        {/* Filter toggle — active filter uses the slate primary so the
            terracotta accents below stay reserved for unread state. */}
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant={unreadOnly ? "outline" : "default"}
            size="sm"
          >
            <Link href="/dashboard/notifications">All</Link>
          </Button>
          <Button
            asChild
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
          >
            <Link href="/dashboard/notifications?unread=1">Unread only</Link>
          </Button>
        </div>
      </div>

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
    </div>
  );
}
