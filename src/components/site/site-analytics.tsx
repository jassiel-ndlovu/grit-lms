"use client";

/**
 * Privacy-friendly page counts (#216): Vercel Web Analytics, which sets no
 * cookies and keeps no personal data. Only public pages are counted; signed-in
 * pages, sign-in links and query strings are never sent. The root layout
 * renders this on the production deployment only.
 *
 * The owner switches it on once in Vercel (Project, Analytics, Enable). Until
 * then the script's requests fail quietly and nothing is counted.
 */

import { Analytics } from "@vercel/analytics/next";

import { isPublicPath } from "@/lib/site";

export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        if (!isPublicPath(url.pathname)) return null;
        // Keep campaign tags only; drop anything else in the query.
        const keep = new URLSearchParams();
        for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
          const v = url.searchParams.get(k);
          if (v) keep.set(k, v.slice(0, 60));
        }
        url.search = keep.toString();
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
