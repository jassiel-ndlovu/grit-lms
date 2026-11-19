/**
 * The checks every billing page makes before it loads anything: billing is
 * switched on (BILLING=1), someone is signed in, and they hold
 * `billing.view` in a workspace. Anything else is a 404, as for the overview.
 */

import "server-only";

import { notFound, redirect } from "next/navigation";

import { isBillingEnabled } from "@/features/billing/errors";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale, type DateContext } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export async function requireBillingPage(): Promise<{ ctx: DateContext; canManage: boolean }> {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "billing.view")) notFound();
  const prefs = await getUserPreferences(viewer.user.id);
  return {
    ctx: { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) },
    canManage: can(viewer, "billing.manage"),
  };
}
