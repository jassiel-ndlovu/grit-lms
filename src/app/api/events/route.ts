/**
 * /api/events — legacy route, partially retired.
 *
 * POST is kept for the legacy assignment editor at
 * /dashboard/submissions/create, which adds a calendar event after saving.
 * It now applies the same checks as `createCourseEvent` in
 * `src/features/events/actions.ts`: tutor only, and the tutor must own the
 * course.
 *
 * GET is retired: the calendar reads events through
 * `src/features/events/queries.ts`, and the old client calendars that hit
 * this URL are imported nowhere.
 *
 * TODO[chapter-3-cleanup]: drop this file once the legacy assignment editor
 * moves to the Server Actions.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitNotification } from "@/features/notifications/server";
import { eventChangeNotification } from "@/features/events/notify";
import { forbidden, gone, requireApiRole, tutorOwnsCourse } from "@/lib/api-guard";

/**
 * Retired — read events through `src/features/events/queries.ts`.
 */
export function GET() {
  return gone("Read events through src/features/events/queries.ts.");
}

export async function POST(req: Request) {
  const guard = await requireApiRole("TUTOR");
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();

    if (!(await tutorOwnsCourse(guard.session, body.courseId))) {
      return forbidden("You don't own this course");
    }

    const event = await prisma.courseEvent.create({
      data: {
        title: body.title,
        type: body.type,
        description: body.description,
        duration: body.duration ?? null,
        location: body.location ?? null,
        date: new Date(body.date),
        link: body.link,
        courseId: body.courseId,
      },
    });

    await emitNotification(eventChangeNotification("created", event), { revalidate: false });

    return NextResponse.json(event);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Failed to create event" },
      { status: 500 }
    );
  }
}
