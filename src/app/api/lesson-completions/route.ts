/**
 * /api/lesson-completions — legacy route, partially retired.
 *
 * GET is preserved temporarily because the legacy `LessonCompletionContext`
 * (still used by a handful of student-facing pages that haven't migrated
 * yet) reads completions through `axios.get("/api/lesson-completions?…")`
 * with three different query shapes (`studentId`, `lessonId`, or both).
 *
 * POST has been retired in favour of the typed Server Action
 * `markLessonComplete` in `src/features/lessons/actions.ts`. This handler
 * returns 410 Gone so any stale caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once
 * `LessonCompletionContext` is deleted (or migrated to RSC queries) along
 * with its remaining consumers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const lessonId = searchParams.get("lessonId");

    let completions;
    if (studentId && lessonId) {
      completions = await prisma.lessonCompletion.findFirst({
        where: { studentId, lessonId },
        include: { student: true, lesson: true },
      });
    } else if (studentId) {
      completions = await prisma.lessonCompletion.findMany({
        where: { studentId },
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    } else if (lessonId) {
      completions = await prisma.lessonCompletion.findMany({
        where: { lessonId },
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    } else {
      completions = await prisma.lessonCompletion.findMany({
        include: { student: true, lesson: true },
        orderBy: { completedAt: "desc" },
      });
    }

    return NextResponse.json(completions);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to fetch lesson completions", error: err.message },
      { status: 500 },
    );
  }
}

/**
 * Retired — use `markLessonComplete` Server Action.
 * @see src/features/lessons/actions.ts
 */
export function POST() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the markLessonComplete Server Action (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}
