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
 * MathJax 4 instead of 3. Account-wide notices (A's AccountBanners: email
 * verification, impersonation, billing) go in AppShell's banner slot.
 */

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PreferencesProvider } from "@/components/preferences-provider";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { navSectionsFor } from "@/components/shell/nav-config";
import { isBillingEnabled } from "@/features/billing/errors";
import { getUserPreferences } from "@/features/users/preferences";
import { AccountBanners } from "@/features/workspaces/components/account-banners";
import { auth } from "@/lib/auth";
import { authProvider } from "@/lib/better-auth";
import { resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";
import { isRevampUi, mathJaxVersion } from "@/lib/ui-flags";

import { TWO_FACTOR_LATER_COOKIE } from "../two-factor-setup/cookie";
import DashboardShell from "./dashboard-shell";
import { LegacyProviders } from "./legacy-providers";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [session, viewer] = await Promise.all([auth(), getViewer()]);
  // Signed in with a tutor's sign-in code: choose a password first (#174).
  if (viewer?.user.mustChangePassword) redirect("/set-password");
  // Owners and Nexa admins must set up two-factor sign-in (#178). Better
  // Auth only; "Remind me tomorrow" sets a day-long cookie.
  if (viewer?.user.twoFactorRequired && authProvider() === "better-auth" && !(await cookies()).has(TWO_FACTOR_LATER_COOKIE)) {
    redirect("/two-factor-setup");
  }
  const prefs = session?.user ? await getUserPreferences(session.user.id) : null;

  // The revamp nav goes by viewer.persona and permissions. `role` is only
  // for the legacy shell's own nav and its role chip.
  const role = session?.user?.role ?? "STUDENT";
  const user: ShellUser | null = viewer
    ? {
        name: viewer.user.name,
        email: viewer.user.email,
        imageUrl: viewer.user.imageUrl,
        role,
        workspaces: viewer.workspaces.map((w) => ({ id: w.id, name: w.name, as: w.as })),
        workspaceId: viewer.workspace?.id ?? null,
        canCreateWorkspace:
          isBillingEnabled() && viewer.user.emailVerified && (viewer.persona === "staff" || viewer.persona === "none"),
      }
    : null;

  const shell = isRevampUi() ? (
    <LegacyProviders mathjax={mathJaxVersion()}>
      <AppShell
        user={user ?? { name: "", email: "", role }}
        sections={navSectionsFor(viewer, { billing: isBillingEnabled() })}
        banner={viewer ? <AccountBanners viewer={viewer} /> : null}
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
