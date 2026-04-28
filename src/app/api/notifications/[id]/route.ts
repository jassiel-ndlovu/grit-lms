/**
 * /api/notifications/[id] — fully retired.
 *
 * The legacy PUT toggled `isRead` for a single notification. Both writers
 * (the header bell and the notifications page) have moved to the
 * `markNotificationRead` / `markNotificationUnread` Server Actions in
 * `src/features/notifications/actions.ts`. This handler returns 410 Gone
 * so any stale caller fails loudly.
 *
 * No GET to preserve — nothing reads through this URL today. The legacy
 * NotificationsContext only fetches the collection.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once we're confident no
 * legacy callers remain (sweep alongside `NotificationsContext`).
 */

import { NextResponse } from "next/server";

/**
 * Retired — use `markNotificationRead` / `markNotificationUnread`
 * Server Actions.
 * @see src/features/notifications/actions.ts
 */
export function PUT() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the markNotificationRead / markNotificationUnread Server Actions (src/features/notifications/actions.ts).",
    },
    { status: 410 },
  );
}
