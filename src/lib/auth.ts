/**
 * Centralized auth — single source of truth for NextAuth config and
 * session helpers usable from RSC, Route Handlers, and Server Actions.
 * `auth()` reads Better Auth instead once AUTH_PROVIDER=better-auth (the
 * cutover; src/lib/better-auth.ts).
 *
 * Importing this file does NOT call NextAuth(); it only exports configuration
 * and helpers. The Route Handler at /app/api/auth/[...nextauth]/route.ts wraps
 * `authOptions` with NextAuth() to produce the GET/POST handlers.
 */

import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { headers } from "next/headers";
import { cache } from "react";

import { authProvider, betterAuthInstance } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/features/shared/enums";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AppTypes.User | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("No user found with this email.");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );
        if (!isValid) {
          throw new Error("Invalid password.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        } as AppTypes.User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name as string;
        token.email = user.email as string;
        token.role = (user as AppTypes.User).role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
    signOut: "/",
  },
  events: {
    async signIn({ user }) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
        },
      });
    },
    async signOut({ token }) {
      await prisma.activityLog.create({
        data: {
          userId: token.id as string,
          action: "LOGOUT",
        },
      });
    },
  },
};

/**
 * Get the current session, or null if unauthenticated.
 * Safe to call from RSC, Route Handlers, and Server Actions.
 */
export async function auth(): Promise<Session | null> {
  if (authProvider() === "better-auth") return betterAuthSession();
  return getServerSession(authOptions);
}

/**
 * The Better Auth session in the shape the app already reads
 * (`session.user.{id,name,email,role}`), so pages and actions don't change
 * at the cutover. Cached per request.
 */
const betterAuthSession = cache(async (): Promise<Session | null> => {
  const s = await betterAuthInstance.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string | null };
  return {
    user: { id: u.id, name: u.name, email: u.email, role: (u.role ?? "TUTOR") as Role },
    expires: new Date(s.session.expiresAt).toISOString(),
  } as Session;
});

/**
 * Get the current session or throw. Use in code paths that should never
 * be reached by anonymous users.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Not authenticated");
  }
  return session;
}

/**
 * Get the current session and assert the user holds one of the given roles.
 * Throws AuthError on failure — callers (or the safe-action layer) translate
 * this into a 401/403 or redirect.
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.user.role as Role)) {
    throw new AuthError(`Requires role: ${roles.join(" or ")}`);
  }
  return session;
}

/**
 * Thrown by requireSession / requireRole. Distinct error class so safe-action
 * middleware (and middleware in general) can distinguish auth failures from
 * other thrown errors.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
