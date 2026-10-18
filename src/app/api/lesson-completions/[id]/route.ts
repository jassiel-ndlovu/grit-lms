/**
 * /api/lesson-completions/[id] — fully retired.
 *
 * Completions are read through src/features/lessons/queries.ts and written by markLessonComplete / unmarkLessonComplete.
 * Nothing calls it any more: no page uses the `LessonCompletionContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `LessonCompletionContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/lessons/queries.ts and the Server Actions in src/features/lessons/actions.ts.";

export function GET() {
  return gone(replacement);
}

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
