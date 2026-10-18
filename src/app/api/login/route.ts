/**
 * /api/login — fully retired.
 *
 * Sign-in goes through NextAuth's credentials provider in src/lib/auth.ts.
 * Nothing calls it any more. Every handler returns 410 Gone so a stale
 * caller fails loudly.
 *
 * TODO[chapter-3-cleanup]: drop this file.
 */

import { gone } from "@/lib/api-guard";

const replacement =
  "Sign in through NextAuth (/api/auth).";

export function POST() {
  return gone(replacement);
}
