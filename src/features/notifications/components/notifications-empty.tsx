/**
 * NotificationsEmpty — neutral empty state for the full notifications page.
 * RSC-safe (no client behavior). The copy adapts based on whether the
 * user is filtering for unread-only.
 */

import { Bell } from "lucide-react";

import { Card } from "@/components/ui/card";

export interface NotificationsEmptyProps {
  unreadOnly?: boolean;
}

export function NotificationsEmpty({ unreadOnly }: NotificationsEmptyProps) {
  return (
    <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Bell className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-medium">
          {unreadOnly ? "No unread notifications" : "No notifications yet"}
        </h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {unreadOnly
            ? "You're all caught up. New activity from your courses and tutors will show up here."
            : "Activity from your courses, tutors, and submissions will show up here."}
        </p>
      </div>
    </Card>
  );
}
