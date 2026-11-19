/**
 * Finds the Vercel Blob URLs inside database rows, for deleteCourseContent.
 * Pure: no database, no network. Checked by scripts/check-course-delete.ts.
 *
 * It walks whole rows (strings, arrays, JSON documents), so a file linked
 * from a rich-text body or a student's answers is found as well as one in a
 * typed URL column. The regex matches scripts/lib/blob-audit-core.ts.
 */

const BLOB_URL_REGEX =
  /https:\/\/[a-z0-9-]+\.(?:[a-z]+\.)?blob\.vercel-storage\.com\/[^\s"'()<>[\]\\`]+/gi;

/** Characters a sentence or markdown may leave stuck to the end of a URL. */
const TRAILING_JUNK = /[.,;:!?*_~]+$/;

/**
 * The URL to hand to `del()`: trailing punctuation, the query string
 * (`?download=1`) and the fragment dropped. Null when it isn't a Blob URL.
 */
export function cleanBlobUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(TRAILING_JUNK, ""));
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname.toLowerCase().endsWith(".blob.vercel-storage.com")) return null;
  return `https://${u.hostname.toLowerCase()}${u.pathname}`;
}

/** Every Blob URL in the values, cleaned, de-duplicated and sorted. */
export function collectBlobUrls(values: unknown): string[] {
  const out = new Set<string>();
  const seen = new WeakSet<object>();

  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (!v.includes("blob.vercel-storage.com")) return;
      for (const m of v.matchAll(BLOB_URL_REGEX)) {
        const url = cleanBlobUrl(m[0]);
        if (url) out.add(url);
      }
      return;
    }
    if (!v || typeof v !== "object" || v instanceof Date || seen.has(v)) return;
    seen.add(v);
    for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child);
  };

  walk(values);
  return [...out].sort();
}
