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

/** Contact information surfaced in the footer and support pages. */
export const APP_CONTACT = {
  email: "nkosijassiel@gmail.com",
  phone: "+27 68 698 3265",
  location: "Johannesburg, South Africa",
} as const;

/** Used by metadata and OG tags once a domain is wired up. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
