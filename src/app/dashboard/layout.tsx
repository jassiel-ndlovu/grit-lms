/**
 * Dashboard layout — server half.
 *
 * Reads the signed-in user's preferences once per request and hands the
 * display ones (time zone, locale, theme, list view) to the client shell
 * through PreferencesProvider.
 *
 * Today's UI: the legacy client shell in ./dashboard-shell.tsx.
 * REVAMP_UI=1: the revamp AppShell (components/shell) with the same legacy
 * context providers, so existing pages keep working inside it.
 */

import type { ReactNode } from "react";

import { PreferencesProvider } from "@/components/preferences-provider";
import { AppShell } from "@/components/shell/app-shell";
import { navSectionsForRole } from "@/components/shell/nav-config";
import { getUserPreferences } from "@/features/users/preferences";
import { auth } from "@/lib/auth";
import { resolveLocale } from "@/lib/datetime";
import { isRevampUi } from "@/lib/ui-flags";

import DashboardShell from "./dashboard-shell";
import { LegacyProviders } from "./legacy-providers";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const prefs = session?.user ? await getUserPreferences(session.user.id) : null;

  // TODO(viewer): read getViewer() once src/lib/viewer.ts lands (contracts/viewer.md).
  const user = session?.user;
  const shell = isRevampUi() ? (
    <LegacyProviders>
      <AppShell
        user={{ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "STUDENT" }}
        sections={navSectionsForRole(user?.role)}
      >
        {children}
      </AppShell>
    </LegacyProviders>
  ) : (
    <DashboardShell>{children}</DashboardShell>
  );

  return (
    <PreferencesProvider
      value={{
        timeZone: prefs?.timeZone ?? null,
        locale: resolveLocale(prefs?.preferredLanguage),
        darkMode: prefs?.darkMode ?? false,
        preferredView: prefs?.preferredView ?? "GRID",
      }}
    >
      {shell}
    </PreferencesProvider>
  );
}
