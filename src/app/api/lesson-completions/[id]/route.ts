/**
 * /api/lesson-completions/[id] — legacy route, partially retired.
 *
 * GET is preserved temporarily because `LessonCompletionContext` still
 * fetches single completions through this URL on unmigrated pages.
 *
 * PUT and DELETE have been retired:
 *   - completions are immutable in the new model (you either mark or
 *     unmark; we don't edit the timestamp)
 *   - unmarking is now done via the `unmarkLessonComplete` Server Action
 *     in `src/features/lessons/actions.ts`, which uses `(studentId,
 *     lessonId)` instead of the completion's own id
 *
 * Both retired handlers return 410 Gone so any stale caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this entire file once
 * `LessonCompletionContext` is deleted along with its remaining consumers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const completion = await prisma.lessonCompletion.findUnique({
      where: { id },
      include: { student: true, lesson: true },
    });

    if (!completion) {
      return NextResponse.json(
        { message: "Lesson completion not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(completion);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to fetch lesson completion", error: err.message },
      { status: 500 },
    );
  }
}

/**
 * Retired — completions are immutable; remark via mark/unmark actions.
 * @see src/features/lessons/actions.ts
 */
export function PUT() {
  return NextResponse.json(
    {
      error:
        "Gone. Lesson completions are immutable; use the mark/unmark Server Actions (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}

/**
 * Retired — use `unmarkLessonComplete` Server Action.
 * @see src/features/lessons/actions.ts
 */
export function DELETE() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the unmarkLessonComplete Server Action (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}
