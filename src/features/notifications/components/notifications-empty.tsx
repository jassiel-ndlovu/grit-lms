/**
 * NotificationsEmpty — neutral empty state for the full notifications page.
 * RSC-safe (no client behavior). The copy adapts based on whether the
 * user is filtering for unread-only.
 */

import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";

export interface NotificationsEmptyProps {
  unreadOnly?: boolean;
}

export function NotificationsEmpty({ unreadOnly }: NotificationsEmptyProps) {
  return (
    <Card className="flex min-h-[280px] items-center justify-center p-8 sm:p-12">
      <EmptyState
        illustration={<Scene name="inbox-empty" />}
        title={unreadOnly ? "No unread notifications" : "No notifications yet"}
        description={
          unreadOnly
            ? "You're all caught up. New activity from your courses and tutors will show up here."
            : "Activity from your courses, tutors and assignments will show up here."
        }
      />
    </Card>
  );
}
