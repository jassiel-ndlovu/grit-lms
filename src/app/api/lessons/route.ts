/**
 * /api/lessons — legacy route, partially retired.
 *
 * GET is preserved temporarily because the legacy `LessonContext` (still used
 * by a handful of student-facing pages that haven't migrated yet) reads
 * lessons through `axios.get("/api/lessons?courseId=…")`.
 *
 * POST has been retired in favour of the typed Server Action
 * `createLesson` in `src/features/lessons/actions.ts`. This handler returns
 * 410 Gone so any stale caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once `LessonContext` is
 * deleted (or migrated to RSC queries) along with its remaining consumers.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  const lessons = await prisma.lesson.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { attachmentUrls: true },
  });

  return NextResponse.json(lessons);
}

/**
 * Retired — use `createLesson` Server Action.
 * @see src/features/lessons/actions.ts
 */
export function POST() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the createLesson Server Action (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}
