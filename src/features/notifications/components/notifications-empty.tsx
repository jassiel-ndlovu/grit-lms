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
    <Card className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
        <Bell className="size-6" />
      </div>
      <div>
        <h3 className="font-display text-xl leading-tight text-foreground">
          {unreadOnly ? "No unread notifications" : "No notifications yet"}
        </h3>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          {unreadOnly
            ? "You're all caught up. New activity from your courses and tutors will show up here."
            : "Activity from your courses, tutors, and submissions will show up here."}
        </p>
      </div>
    </Card>
  );
}
