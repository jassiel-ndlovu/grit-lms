/**
 * /api/seed-users — fully retired.
 *
 * It was an unauthenticated GET that created accounts with hard-coded passwords.
 * Nothing calls it any more. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Create users through the Server Actions in src/features/users/actions.ts (/dashboard/manage-users).";

export function GET() {
  return gone(replacement);
}
