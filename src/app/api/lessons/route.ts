/**
 * /api/lessons — fully retired.
 *
 * Lessons are read through src/features/lessons/queries.ts and created by the createLesson Server Action.
 * Nothing calls it any more: no page uses the `LessonContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `LessonContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/lessons/queries.ts and the Server Actions in src/features/lessons/actions.ts.";

export function GET() {
  return gone(replacement);
}

export function POST() {
  return gone(replacement);
}
