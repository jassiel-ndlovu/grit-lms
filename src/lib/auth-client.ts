"use client";

/**
 * Client-side sign-in helpers for B's components (design 02, section 2).
 * Better Auth only, since the 2026-11-20 cutover.
 *
 *   useAppSession()            replaces useSession()
 *   signInWithPassword(...)    replaces signIn("credentials", ...)
 *   signInWithGoogle(...)      new; shown only when googleSignInAvailable
 *   signUpWithPassword(...)    new (after the cutover)
 *   appSignOut(...)            replaces signOut()
 */

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";

/** Better Auth signs everyone in since the 2026-11-20 cutover. */
const BETTER = true;

/** True when the Google button should show (Better Auth on, and Google keys configured). */
export const googleSignInAvailable = BETTER && process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "1";

export const authClient = createAuthClient({
  basePath: "/api/ba",
  plugins: [usernameClient(), twoFactorClient()],
});

export type AppSessionUser = { id: string; name: string; email: string; role: string };
export type AppSession = { status: "loading" | "authenticated" | "unauthenticated"; user: AppSessionUser | null };

function useBetterAuthSession(): AppSession {
  const { data, isPending } = authClient.useSession();
  if (isPending) return { status: "loading", user: null };
  if (!data) return { status: "unauthenticated", user: null };
  const u = data.user as typeof data.user & { role?: string | null };
  return { status: "authenticated", user: { id: u.id, name: u.name, email: u.email, role: u.role ?? "STUDENT" } };
}


/** The signed-in user on the client. The mode is fixed at build time, so this is always the same hook. */
export const useAppSession: () => AppSession = useBetterAuthSession;

export type SignInResult = { ok: true } | { ok: false; error: string; twoFactorRequired?: boolean };

/** Email (or, after the cutover, username) and password. Never says whether an account exists. */
export async function signInWithPassword(input: { identifier: string; password: string; callbackUrl?: string }): Promise<SignInResult> {
  const failed = "That email and password don't match.";
  const isEmail = input.identifier.includes("@");
  const r = isEmail
    ? await authClient.signIn.email({ email: input.identifier, password: input.password, callbackURL: input.callbackUrl })
    : await authClient.signIn.username({ username: input.identifier, password: input.password, callbackURL: input.callbackUrl });
  if (r.error) {
    const code = (r.error as { code?: string }).code;
    if (code === "EMAIL_NOT_VERIFIED") return { ok: false, error: "Please verify your email address first. We've sent you a new link." };
    if (code === "INVALID_ORIGIN" || code === "MISSING_OR_NULL_ORIGIN") return { ok: false, error: "Sign-in isn't available on this address. Use the main Nexa address." };
    if (r.error.status === 403) return { ok: false, error: r.error.message || "You can't sign in right now. Ask your tutor for a new sign-in code." };
    if (r.error.status === 429) return { ok: false, error: "Too many attempts. Try again in a minute, or reset your password." };
    return { ok: false, error: failed };
  }
  const data = r.data as { twoFactorRedirect?: boolean } | null;
  if (data?.twoFactorRedirect) return { ok: false, error: "Enter the code from your authenticator app.", twoFactorRequired: true };
  return { ok: true };
}

/** Starts Google sign-in (and sign-up). Redirects away. */
export async function signInWithGoogle(callbackUrl = "/dashboard/start") {
  await authClient.signIn.social({ provider: "google", callbackURL: callbackUrl, newUserCallbackURL: "/dashboard/welcome" });
}

/** A same-site path ("/…", never "//…" or a full URL), or null. */
function sameSitePath(p: string | undefined): string | null {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return null;
  return p;
}

/**
 * Sign-up. The account must verify its email before signing in; the link in
 * that email returns to `callbackUrl` (a same-site path, for example
 * "/auth/invite/<token>", #174), or to the welcome page.
 */
export async function signUpWithPassword(input: { name: string; email: string; password: string; callbackUrl?: string }): Promise<SignInResult> {
  const callbackURL = sameSitePath(input.callbackUrl) ?? "/dashboard/welcome";
  const r = await authClient.signUp.email({ name: input.name, email: input.email, password: input.password, callbackURL });
  if (r.error) {
    const code = (r.error as { code?: string }).code;
    if (code === "INVALID_ORIGIN" || code === "MISSING_OR_NULL_ORIGIN") return { ok: false, error: "Sign-up isn't available on this address. Use the main Nexa address." };
    return { ok: false, error: r.error.status === 422 ? "You already have an account. Sign in instead." : r.error.message ?? "Sign-up failed." };
  }
  return { ok: true };
}

export async function appSignOut(callbackUrl = "/") {
  await authClient.signOut();
  window.location.href = callbackUrl;
}
