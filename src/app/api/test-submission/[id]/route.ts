/**
 * /api/test-submission/[id] — fully retired.
 *
 * Test attempts run through the RSC test runner and the assessments Server Actions; the old client runner (use-test-session.ts) is imported nowhere.
 * Nothing calls it any more: no page uses the `TestSubmissionContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `TestSubmissionContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/assessments/queries.ts and the Server Actions in src/features/assessments/actions.ts.";

export function GET() {
  return gone(replacement);
}

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
