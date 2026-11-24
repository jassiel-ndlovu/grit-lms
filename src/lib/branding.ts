/**
 * Single source of truth for product branding.
 * Update names, taglines, and contact info here — not in components.
 *
 * Why this exists:
 * - Renaming the product means changing one file, not 30.
 * - Metadata, footers, auth screens, and emails all import from here.
 */

export const APP_NAME = "Nexa LMS" as const;
export const APP_SHORT_NAME = "Nexa" as const;
export const APP_TAGLINE = "A modern learning platform." as const;
export const APP_DESCRIPTION =
  "A modern learning platform for students and educators." as const;

/** Used in legal copy, email signatures, and metadata. */
export const APP_LEGAL_NAME = "Nexa LMS" as const;

/**
 * How people reach Nexa: the help centre and the contact form, never a
 * personal address or number (owner, 24 Nov). Where Nexa's own team gets
 * mail is server-only: NEXA_INBOX in lib/email/config.ts.
 */
export const APP_CONTACT = {
  /** Help, questions and problem reports. */
  supportPath: "/support",
  /** Accounts and organisations (the enquiry form). */
  contactPath: "/contact",
  location: "South Africa",
} as const;

/** Used by metadata and OG tags once a domain is wired up. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
