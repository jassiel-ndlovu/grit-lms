/**
 * Better Auth's endpoints (stage 1 of the move off NextAuth; see
 * src/lib/better-auth.ts). Answers 404 unless BETTER_AUTH_ENABLED=1, so
 * production is unchanged until the cutover.
 */

import { toNextJsHandler } from "better-auth/next-js";

import { betterAuthEnabled, betterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(betterAuthInstance);
const off = () => new Response("Not found", { status: 404 });

export async function GET(req: Request) {
  return betterAuthEnabled() ? handlers.GET(req) : off();
}

export async function POST(req: Request) {
  return betterAuthEnabled() ? handlers.POST(req) : off();
}
