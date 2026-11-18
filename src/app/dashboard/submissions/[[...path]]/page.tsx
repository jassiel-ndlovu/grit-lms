/**
 * /dashboard/submissions/** — the old home of assignments. Every old URL
 * redirects permanently to its /dashboard/assignments page, keeping the
 * query string. Old links live on in emails, notifications and bookmarks,
 * so keep this page.
 */

import { permanentRedirect } from "next/navigation";

import { legacyAssignmentPath } from "@/features/submissions/routes";

export default async function LegacySubmissionsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  // Next hands the segments over decoded.
  const target = legacyAssignmentPath(path ?? []);

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v);
  }
  const search = qs.toString();
  permanentRedirect(search ? `${target}?${search}` : target);
}
