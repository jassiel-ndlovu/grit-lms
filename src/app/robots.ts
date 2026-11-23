import type { MetadataRoute } from "next";

import { indexable, PRIVATE_PREFIXES, siteUrl } from "@/lib/site";

/** /robots.txt (#216). Preview and local deployments ask every crawler to stay out. */
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PREFIXES] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
