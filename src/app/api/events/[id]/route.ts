/**
 * /api/events/[id] — fully retired.
 *
 * Event reads go through `src/features/events/queries.ts`; updates and
 * deletes go through `updateCourseEvent` / `deleteCourseEvent` in
 * `src/features/events/actions.ts`. The only legacy callers (the client
 * calendars in src/app/dashboard/calendar) are imported nowhere.
 *
 * TODO[chapter-3-cleanup]: drop this file with `EventContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/events/queries.ts and the updateCourseEvent / deleteCourseEvent Server Actions (src/features/events/actions.ts).";

export function GET() {
  return gone(replacement);
}

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
