"use client";

/**
 * Client-side sign-in helpers for B's components (design 02, section 2).
 * Each works with whichever system is on (NEXT_PUBLIC_AUTH_PROVIDER, set
 * together with AUTH_PROVIDER), so B can swap its imports from
 * `next-auth/react` before the cutover and nothing changes until it.
 *
 *   useAppSession()            replaces useSession()
 *   signInWithPassword(...)    replaces signIn("credentials", ...)
 *   signInWithGoogle(...)      new; shown only when googleSignInAvailable
 *   signUpWithPassword(...)    new (after the cutover)
 *   appSignOut(...)            replaces signOut()
 */

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession as useNextAuthSession } from "next-auth/react";

const BETTER = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "better-auth";

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

function useNextAuthAppSession(): AppSession {
  const { data, status } = useNextAuthSession();
  if (status === "loading") return { status, user: null };
  if (!data?.user) return { status: "unauthenticated", user: null };
  const u = data.user as { id?: string; name?: string | null; email?: string | null; role?: string };
  return { status: "authenticated", user: { id: u.id ?? "", name: u.name ?? "", email: u.email ?? "", role: u.role ?? "" } };
}

/** The signed-in user on the client. The mode is fixed at build time, so this is always the same hook. */
export const useAppSession: () => AppSession = BETTER ? useBetterAuthSession : useNextAuthAppSession;

export type SignInResult = { ok: true } | { ok: false; error: string; twoFactorRequired?: boolean };

/** Email (or, after the cutover, username) and password. Never says whether an account exists. */
export async function signInWithPassword(input: { identifier: string; password: string; callbackUrl?: string }): Promise<SignInResult> {
  const failed = "That email and password don't match.";
  if (!BETTER) {
    const r = await nextAuthSignIn("credentials", { email: input.identifier, password: input.password, redirect: false });
    return r?.ok && !r.error ? { ok: true } : { ok: false, error: failed };
  }
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

/** Staff sign-up (after the cutover). The account must verify its email before signing in. */
export async function signUpWithPassword(input: { name: string; email: string; password: string }): Promise<SignInResult> {
  if (!BETTER) return { ok: false, error: "Sign-up isn't open yet." };
  const r = await authClient.signUp.email({ name: input.name, email: input.email, password: input.password, callbackURL: "/dashboard/welcome" });
  if (r.error) {
    const code = (r.error as { code?: string }).code;
    if (code === "INVALID_ORIGIN" || code === "MISSING_OR_NULL_ORIGIN") return { ok: false, error: "Sign-up isn't available on this address. Use the main Nexa address." };
    return { ok: false, error: r.error.status === 422 ? "You already have an account. Sign in instead." : r.error.message ?? "Sign-up failed." };
  }
  return { ok: true };
}

export async function appSignOut(callbackUrl = "/") {
  if (!BETTER) return nextAuthSignOut({ callbackUrl });
  await authClient.signOut();
  window.location.href = callbackUrl;
}
