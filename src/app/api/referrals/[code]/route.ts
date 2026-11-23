/**
 * GET /api/referrals/<code>: a parent's or student's referral link (#216).
 * Keeps the code in a cookie for 30 days and opens the workspace's courses
 * on Find courses. An unknown code just opens Find courses.
 */

import { NextResponse, type NextRequest } from "next/server";

import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS, referralTarget } from "@/features/workspaces/referrals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = await referralTarget(code.toLowerCase());
  const dest = new URL(target ? `/dashboard/courses/browse?workspace=${encodeURIComponent(target.workspaceId)}` : "/dashboard/courses/browse", req.url);
  const res = NextResponse.redirect(dest, 303);
  if (target) {
    res.cookies.set(REFERRAL_COOKIE, target.code, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
    });
  }
  return res;
}
