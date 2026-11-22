/**
 * Session helpers usable from RSC, Route Handlers and Server Actions.
 *
 * Better Auth signs everyone in (src/lib/better-auth.ts; production since
 * 2026-11-20). `auth()` returns its session in the shape the app has
 * always read (`session.user.{id,name,email,role}`), so pages and actions
 * didn't change at the cutover. NextAuth is gone from A's code; its package
 * stays installed only until B's providers.tsx stops importing it.
 */

import { headers } from "next/headers";
import { cache } from "react";

import { betterAuthInstance } from "@/lib/better-auth";
import type { Role } from "@/features/shared/enums";

export type Session = {
  user: { id: string; name: string; email: string; role: Role };
  expires: string;
};

/** The current session, or null when signed out. Cached per request. */
export const auth = cache(async (): Promise<Session | null> => {
  const s = await betterAuthInstance.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string | null };
  return {
    user: { id: u.id, name: u.name, email: u.email, role: (u.role ?? "STUDENT") as Role },
    expires: new Date(s.session.expiresAt).toISOString(),
  };
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
