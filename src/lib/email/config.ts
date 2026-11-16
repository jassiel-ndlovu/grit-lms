/**
 * Email configuration — the one place to change who mail comes from.
 *
 * There is no custom domain yet, so mail goes out from Resend's shared dev
 * sender. Resend only delivers dev-sender mail to the address that owns the
 * Resend account; sends to anyone else are rejected (we log and move on).
 *
 * The planned sender is the `notify.nexa-lms.co.za` subdomain of
 * `nexa-lms.co.za` (not yet bought or verified). Once Resend has verified
 * it, set EMAIL_FROM in the environment, e.g.
 *
 *   EMAIL_FROM="Nexa LMS <noreply@notify.nexa-lms.co.za>"
 *
 * Nothing else needs to change. Until then, leave EMAIL_FROM unset so the
 * dev sender below keeps working.
 */

import "server-only";

import { APP_NAME } from "@/lib/branding";

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;

/** Optional Reply-To, e.g. a support inbox. */
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

export const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Absolute base URL for links inside emails. Emails are read outside the
 * app, so relative links won't do.
 */
export const EMAIL_APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${EMAIL_APP_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
