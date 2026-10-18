/**
 * /api/students/[id] — fully retired.
 *
 * Student accounts are managed through the user-management Server Actions.
 * Nothing calls it any more: no page uses the `StudentContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `StudentContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/students/queries.ts and the Server Actions in src/features/users/actions.ts (/dashboard/manage-users).";

export function PUT() {
  return gone(replacement);
}

export function DELETE() {
  return gone(replacement);
}
