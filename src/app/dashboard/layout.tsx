/**
 * Dashboard layout — server half.
 *
 * Reads the viewer (getViewer, contracts/viewer.md) and the user's
 * preferences once per request. The shell gets the viewer's name, email,
 * avatar and role as props (legacy Batch 2, design 07; the header and nav
 * used to fetch these through ProfileContext). The display preferences
 * (time zone, locale, theme, list view) go through PreferencesProvider.
 *
 * Today's UI: the legacy client shell in ./dashboard-shell.tsx.
 * REVAMP_UI=1: the revamp AppShell (components/shell) with the same legacy
 * context providers, so existing pages keep working inside it, and
 * MathJax 4 instead of 3.
 */

import type { ReactNode } from "react";

import { PreferencesProvider } from "@/components/preferences-provider";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { navSectionsForRole } from "@/components/shell/nav-config";
import { getUserPreferences } from "@/features/users/preferences";
import { auth } from "@/lib/auth";
import { resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";
import { isRevampUi, mathJaxVersion } from "@/lib/ui-flags";

import DashboardShell from "./dashboard-shell";
import { LegacyProviders } from "./legacy-providers";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [session, viewer] = await Promise.all([auth(), getViewer()]);
  const prefs = session?.user ? await getUserPreferences(session.user.id) : null;

  // Nav still goes by the legacy session role until it moves to
  // viewer.persona (contracts/navigation.md, "When getViewer() lands").
  const role = session?.user?.role ?? "STUDENT";
  const user: ShellUser | null = viewer
    ? { name: viewer.user.name, email: viewer.user.email, imageUrl: viewer.user.imageUrl, role }
    : null;

  const shell = isRevampUi() ? (
    <LegacyProviders mathjax={mathJaxVersion()}>
      <AppShell
        user={user ?? { name: "", email: "", role }}
        sections={navSectionsForRole(role)}
      >
        {children}
      </AppShell>
    </LegacyProviders>
  ) : (
    <DashboardShell user={user}>{children}</DashboardShell>
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
