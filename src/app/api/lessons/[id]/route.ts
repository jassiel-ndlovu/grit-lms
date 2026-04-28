/**
 * /api/lessons/[id] — fully retired.
 *
 * PUT and DELETE have been replaced by the typed Server Actions
 * `updateLesson` and `deleteLesson` in `src/features/lessons/actions.ts`.
 * Both handlers now return 410 Gone so any stale caller fails loudly.
 *
 * No GET to preserve — nothing reads through this URL today (the legacy
 * LessonContext only hits `/api/lessons?courseId=…`).
 *
 * TODO[chapter-3-cleanup]: drop this entire file once we're confident no
 * legacy callers remain (sweep alongside `src/context/LessonContext.tsx`).
 */

import { NextResponse } from "next/server";

/**
 * Retired — use `updateLesson` Server Action.
 * @see src/features/lessons/actions.ts
 */
export function PUT() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the updateLesson Server Action (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}

/**
 * Retired — use `deleteLesson` Server Action.
 * @see src/features/lessons/actions.ts
 */
export function DELETE() {
  return NextResponse.json(
    {
      error:
        "Gone. Use the deleteLesson Server Action (src/features/lessons/actions.ts).",
    },
    { status: 410 },
  );
}
