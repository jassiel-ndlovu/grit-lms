/**
 * /api/question-grades/[id] — fully retired.
 *
 * Per-question grades are written by the grading Server Actions.
 * Nothing calls it any more: no page uses the `QuestionGradeContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `QuestionGradeContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/grades/queries.ts and the grading Server Actions in src/features/assessments/actions.ts and src/features/submissions/actions.ts.";

export function GET() {
  return gone(replacement);
}

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
