/**
 * RETIRED — replaced by Server Actions in `@/features/courses/actions`.
 *
 *   PUT  /api/courses/[id]  → updateCourse({ id, ... })
 *   DEL  /api/courses/[id]  → deleteCourse({ id })
 *
 * This file should be deleted in the same commit that migrates the last
 * caller. It currently returns 410 Gone so any stale client surfaces a
 * loud failure rather than silently succeeding against the wrong code.
 *
 * TODO[chapter-2-cleanup]: rm src/app/api/courses/[id]/route.ts
 */

import { NextResponse } from "next/server";

const GONE = NextResponse.json(
  {
    error:
      "This endpoint has been retired. Use the createCourse/updateCourse/deleteCourse Server Actions instead.",
  },
  { status: 410 },
);

export async function PUT() {
  return GONE;
}

export async function DELETE() {
  return GONE;
}
