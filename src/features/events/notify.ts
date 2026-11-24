/**
 * Notification payloads for calendar event changes, shared by the event
 * Server Actions and the legacy /api/events routes.
 */

import type { CreateNotificationInput } from "@/features/notifications/schemas";

const KIND_LABEL: Record<string, string> = {
  LECTURE: "Lesson",
  TEST: "Test",
  REMINDER: "Reminder",
  SUBMISSION: "Assignment",
  LIVE: "Live session",
  EXAM: "Exam",
  MEETING: "Meeting",
  HOLIDAY: "Holiday",
};

export function eventChangeNotification(
  change: "created" | "updated" | "deleted",
  event: { title: string; type: string; courseId: string },
): CreateNotificationInput {
  const kind = KIND_LABEL[event.type] ?? "Event";
  const verb = { created: "scheduled", updated: "updated", deleted: "cancelled" }[change];
  return {
    title: `${kind} ${verb}`,
    message: `"${event.title}" was ${verb}. Open the calendar for the details.`,
    link: "/dashboard/calendar",
    type: change === "created" ? "EVENT_CREATED" : change === "updated" ? "EVENT_UPDATED" : "EVENT_DELETED",
    courseId: event.courseId,
  };
}
