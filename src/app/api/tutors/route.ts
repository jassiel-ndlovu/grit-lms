/**
 * /api/tutors — fully retired.
 *
 * Tutor accounts are managed through the user-management Server Actions.
 * Nothing calls it any more: no page uses the `TutorContext` methods that
 * hit this URL. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file with `TutorContext`.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Use src/features/students/queries.ts and the Server Actions in src/features/users/actions.ts (/dashboard/manage-users).";

export function GET() {
  return gone(replacement);
}

export function POST() {
  return gone(replacement);
}
