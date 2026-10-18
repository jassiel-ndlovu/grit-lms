/**
 * /api/tests/[id] — fully retired.
 *
 * Tests are written through the assessments Server Actions.
 * Nothing calls it any more: no page uses the `TestContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `TestContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/assessments/queries.ts and the Server Actions in src/features/assessments/actions.ts.";

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
