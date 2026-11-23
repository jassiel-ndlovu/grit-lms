/**
 * The public site's address and which pages search engines may see (#216,
 * A's search setup). Used by src/app/sitemap.ts, src/app/robots.ts and the
 * root layout's metadataBase.
 */

/** The canonical origin: NEXT_PUBLIC_APP_URL, else Vercel's production URL, else localhost. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw =
    env.NEXT_PUBLIC_APP_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

/** Only the production deployment is indexed; Preview and local say "keep out". */
export function indexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

/** Public pages in the sitemap. B adds a page here when it ships one. */
export const PUBLIC_PAGES: ReadonlyArray<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/auth/sign-up", priority: 0.6, changeFrequency: "monthly" },
  { path: "/support", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
];

/** Never crawled: signed-in areas, APIs and one-time links. */
export const PRIVATE_PREFIXES = [
  "/dashboard",
  "/api",
  "/account",
  "/auth/invite",
  "/set-password",
  "/verify-email",
  "/forgot-password",
  "/two-factor-setup",
  "/design-system",
] as const;

/** True for paths analytics may count: public pages only, never signed-in ones. */
export function isPublicPath(pathname: string): boolean {
  return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
