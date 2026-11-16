/**
 * Who may trigger a job route. docs/revamp/a/design/06-deployment.md §5.
 *
 * Stage 1 accepts `Authorization: Bearer $CRON_SECRET` (GitHub Actions,
 * Vercel Cron, a manual curl). Stage 2 adds QStash's `Upstash-Signature`
 * check here, so routes and callers do not change.
 *
 * Fails closed: with no CRON_SECRET set, nothing is accepted in production.
 * Outside production (local dev) an unset secret lets requests through, as
 * the old routes did.
 */

import { timingSafeEqual } from "node:crypto";

export type JobAuth =
  | { ok: true; trigger: "bearer" | "dev" }
  | { ok: false; status: 401 | 500; error: string };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyJobRequest(
  headers: Pick<Headers, "get">,
  env: { CRON_SECRET?: string; NODE_ENV?: string } = process.env,
): JobAuth {
  const secret = env.CRON_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      return { ok: false, status: 500, error: "CRON_SECRET is not configured" };
    }
    return { ok: true, trigger: "dev" };
  }
  const header = headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ") && safeEqual(header.slice(7), secret)) {
    return { ok: true, trigger: "bearer" };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}
