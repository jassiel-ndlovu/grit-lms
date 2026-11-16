/**
 * /api/notifications — legacy route, partially retired.
 *
 * GET is preserved temporarily because the legacy `NotificationsContext`
 * still hits it on a couple of unmigrated pages (calendar, course
 * overview). The two writer pages (header bell and the full notifications
 * page) have moved to typed Server Actions in
 * `src/features/notifications/actions.ts`, so the PUT (mark all read)
 * handler is retired below.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once
 * `NotificationsContext` is deleted (or migrated to RSC queries) along
 * with its remaining consumers.
 */

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  buildRecipientWhere,
  getNotificationViewer,
} from "@/features/notifications/queries";

/**
 * Returns the caller's own notifications only. The `studentId` and
 * `courseIds` query parameters the legacy context still sends are ignored:
 * they used to select whose rows came back, so any signed-in user could read
 * anyone's notifications. The recipient filter is the same one the
 * notifications feature uses (`buildRecipientWhere`).
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.id || !token.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewer = await getNotificationViewer({
      id: token.id as string,
      email: token.email,
      role: String(token.role ?? ""),
    });
    const where = await buildRecipientWhere(viewer);

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        course: { select: { name: true, imageUrl: true } },
        student: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Retired — use `markAllNotificationsRead` Server Action.
 * @see src/features/notifications/actions.ts
 */
export function PUT() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the markAllNotificationsRead Server Action (src/features/notifications/actions.ts).",
    },
    { status: 410 },
  );
}
