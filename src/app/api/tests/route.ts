/**
 * /api/tests — fully retired.
 *
 * Tests are read and written through src/features/assessments; the old client test runner (src/app/dashboard/tests/hooks/use-test-session.ts) is imported nowhere.
 * Nothing calls it any more: no page uses the `TestContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `TestContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/assessments/queries.ts and the Server Actions in src/features/assessments/actions.ts.";

export function GET() {
  return gone(replacement);
}

export function POST() {
  return gone(replacement);
}
