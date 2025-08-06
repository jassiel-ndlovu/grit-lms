// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // If token exists (user is authenticated), return true
        // If no token, redirect to login page
        return !!token;
      },
    },
    pages: {
      signIn: "/", // Your login page route
    },
  }
);

// Specify protected routes
export const config = {
  matcher: [
    "/dashboard/:path*", // Protect all dashboard routes
  ],
};