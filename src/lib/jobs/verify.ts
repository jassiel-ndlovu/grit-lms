/**
 * Who may trigger a job route. docs/revamp/a/design/06-deployment.md §5.
 *
 * Accepts either:
 *   - `Upstash-Signature` from a QStash schedule, verified with
 *     QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY against the exact
 *     public URL of the route (APP_URL, or Vercel's production domain).
 *     Passing the URL matters: without it a signature meant for any other
 *     endpoint of the QStash account would be accepted.
 *   - `Authorization: Bearer $CRON_SECRET` (the GitHub Actions backup,
 *     Vercel Cron, a manual curl), compared in constant time.
 *
 * Fails closed: in production a request is refused when the secret or keys
 * its method needs are not configured. Outside production an unset
 * CRON_SECRET lets Bearer-less requests through, as the old routes did.
 *
 * A QStash signature stays valid for 5 minutes and could be replayed in
 * that window; every job is idempotent, so a replay only repeats a no-op.
 */

import { timingSafeEqual } from "node:crypto";

import { Receiver } from "@upstash/qstash";

export type JobAuth =
  | { ok: true; trigger: "bearer" | "qstash" | "dev" }
  | { ok: false; status: 401 | 500; error: string };

export type JobEnv = {
  CRON_SECRET?: string;
  NODE_ENV?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export type JobRequest = {
  headers: Pick<Headers, "get">;
  /** Raw request body (QStash signs it). Empty for scheduled calls. */
  body: string;
  /** Route path, e.g. "/api/cron/auto-submit". */
  path: string;
};

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The origin QStash schedules publish to. Must match scripts/qstash-sync-schedules.ts. */
export function publicOrigin(env: JobEnv): string | null {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

export async function verifyJobRequest(
  req: JobRequest,
  env: JobEnv = process.env,
  receiver?: Pick<Receiver, "verify">,
): Promise<JobAuth> {
  const prod = env.NODE_ENV === "production";

  const signature = req.headers.get("upstash-signature");
  if (signature) {
    if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
      return { ok: false, status: prod ? 500 : 401, error: "QStash signing keys are not configured" };
    }
    const origin = publicOrigin(env);
    if (!origin) return { ok: false, status: 500, error: "APP_URL is not configured" };
    const r =
      receiver ??
      new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
      });
    try {
      const valid = await r.verify({ signature, body: req.body, url: `${origin}${req.path}` });
      return valid ? { ok: true, trigger: "qstash" } : { ok: false, status: 401, error: "Unauthorized" };
    } catch {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
  }

  const secret = env.CRON_SECRET;
  if (!secret) {
    if (prod) return { ok: false, status: 500, error: "CRON_SECRET is not configured" };
    return { ok: true, trigger: "dev" };
  }
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ") && safeEqual(header.slice(7), secret)) {
    return { ok: true, trigger: "bearer" };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}
