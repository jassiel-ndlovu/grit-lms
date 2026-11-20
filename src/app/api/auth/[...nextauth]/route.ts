/**
 * Stand-in for NextAuth's old endpoints, which Better Auth replaced on
 * 2026-11-20. B's providers.tsx still mounts next-auth's SessionProvider,
 * which asks /api/auth/session on every page; answer "no session" so it
 * stays quiet. Delete this, and the next-auth package, once providers.tsx
 * no longer uses it.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({});
}

export function POST() {
  return NextResponse.json({});
}
