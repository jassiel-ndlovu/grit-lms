/**
 * Dashboard layout — server half.
 *
 * Reads the signed-in user's preferences once per request and hands the
 * display ones (time zone, locale, theme, list view) to the client shell
 * through PreferencesProvider. The shell itself (nav, header, legacy
 * context providers) stays a client component in ./dashboard-shell.tsx.
 */

import type { ReactNode } from "react";

import { PreferencesProvider } from "@/components/preferences-provider";
import { getUserPreferences } from "@/features/users/preferences";
import { auth } from "@/lib/auth";
import { resolveLocale } from "@/lib/datetime";

import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const prefs = session?.user ? await getUserPreferences(session.user.id) : null;

  return (
    <PreferencesProvider
      value={{
        timeZone: prefs?.timeZone ?? null,
        locale: resolveLocale(prefs?.preferredLanguage),
        darkMode: prefs?.darkMode ?? false,
        preferredView: prefs?.preferredView ?? "GRID",
      }}
    >
      <DashboardShell>{children}</DashboardShell>
    </PreferencesProvider>
  );
}
