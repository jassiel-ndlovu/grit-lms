/**
 * Optimistic sign-in check for /dashboard and the sign-in page. The real
 * check happens in getViewer() / auth(). Works with either sign-in system
 * (AUTH_PROVIDER; see src/lib/better-auth.ts): Better Auth's session
 * cookie, or NextAuth's JWT.
 */

import { getSessionCookie } from "better-auth/cookies";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

async function signedIn(req: NextRequest): Promise<boolean> {
  if (process.env.AUTH_PROVIDER === "better-auth") return getSessionCookie(req, { cookiePrefix: "nexa" }) != null;
  return (await getToken({ req })) != null;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isIn = await signedIn(req);

  // Signed in and on the sign-in page: go to their chosen start page.
  if (isIn && pathname === "/") return NextResponse.redirect(new URL("/dashboard/start", req.url));

  // Signed out on a dashboard page: to sign-in, coming back afterwards.
  if (!isIn && pathname.startsWith("/dashboard")) {
    const to = new URL("/", req.url);
    to.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/"],
};
