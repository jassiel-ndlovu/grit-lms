// eslint-disable @typescript-eslint/no-unused-vars
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // You can add custom logic here if needed
    if (req.nextUrl.pathname.startsWith("/dashboard")) {
    
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