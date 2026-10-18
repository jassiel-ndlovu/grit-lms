/**
 * /api/grades/[id] — fully retired.
 *
 * Grades are read and written by the RSC gradebook and the grading Server Actions.
 * Nothing calls it any more: no page uses the `GradeContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `GradeContext`.
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
