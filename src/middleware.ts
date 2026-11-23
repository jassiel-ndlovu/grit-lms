/**
 * Optimistic sign-in check for /dashboard and the sign-in page: Better
 * Auth's session cookie. The real check happens in getViewer() / auth().
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isIn = getSessionCookie(req, { cookiePrefix: "nexa" }) != null;

  // Signed in and on the sign-in page: go to their chosen start page.
  if (isIn && pathname === "/") return NextResponse.redirect(new URL("/dashboard/start", req.url));

  // Signed out on a dashboard page: to sign-in, coming back afterwards.
  if (!isIn && pathname.startsWith("/dashboard")) {
    const to = new URL("/auth", req.url);
    to.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/"],
};
