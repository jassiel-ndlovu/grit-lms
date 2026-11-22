/**
 * /dashboard/settings — signed-in user preferences.
 *
 * Server Component. Reads the user's UserPreferences (defaults if they
 * have never saved) and hands the current values to a client-side
 * SettingsForm, which shows only the options relevant to the user's role.
 * All writes flow through updateOwnPreferences.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  SettingsForm,
  type SettingsFormValues,
} from "@/features/users/components/settings-form";
import { getUserPreferences } from "@/features/users/preferences";
import { resolveLocale } from "@/lib/datetime";
import { isBillingEnabled } from "@/features/billing/errors";
import { can, getViewer } from "@/lib/viewer";
import { isRevampUi } from "@/lib/ui-flags";
import { ThemeSetting } from "@/features/courses/components/theme-picker";
import HeaderSettings from "@/components/illustrations/generated/header-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user) redirect("/auth");

  const [prefs, viewer] = await Promise.all([getUserPreferences(session.user.id), getViewer()]);
  // Billing (BILLING=1) is for people with billing.view in the active workspace.
  const showBilling = isBillingEnabled() && viewer?.workspace != null && can(viewer, "billing.view");
  // Payouts: whoever connects the account, or manages fees (tutors in per-tutor mode).
  const showMembers = viewer?.workspace != null && can(viewer, "members.invite");
  // The teaching switch (#206): organisations, for owners and admins.
  const showOrganisation = viewer?.workspace?.kind === "ORGANISATION" && can(viewer, "workspace.settings");
  const showPayouts =
    isBillingEnabled() && viewer?.workspace != null && (can(viewer, "payouts.connect") || can(viewer, "fees.manage"));
  const defaults: SettingsFormValues = {
    emailNotifications: prefs.emailNotifications && prefs.notificationFrequency !== "NONE",
    notificationFrequency: prefs.notificationFrequency,
    notifyOnCourseUpdate: prefs.notifyOnCourseUpdate,
    notifyOnNewLesson: prefs.notifyOnNewLesson,
    notifyOnNewTest: prefs.notifyOnNewTest,
    notifyOnDueDateReminder: prefs.notifyOnDueDateReminder,
    notifyOnGrades: prefs.notifyOnGrades,
    studyReminders: prefs.studyReminders,
    notifyOnSubmissions: prefs.notifyOnSubmissions,
    notifyOnGradingQueue: prefs.notifyOnGradingQueue,
    darkMode: prefs.darkMode,
    preferredLanguage: resolveLocale(prefs.preferredLanguage),
    timeZone: prefs.timeZone,
    preferredView: prefs.preferredView,
    defaultDashboardTab: prefs.defaultDashboardTab,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">
              Preferences
            </p>
            <h1 className="font-display mt-1 text-2xl sm:text-3xl leading-tight tracking-tight">
              Settings
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Choose what you hear about, how the app looks and where you
              land. Changes apply when you click &ldquo;Save preferences&rdquo;.
            </p>
          </div>
          <div className="illustration-paper hidden h-32 w-40 shrink-0 items-end justify-center md:flex">
            <HeaderSettings className="h-full w-auto" />
          </div>
        </div>
      </section>

      <Link
        href="/dashboard/settings/account"
        className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
      >
        <span>
          <span className="text-foreground block font-semibold">Account</span>
          <span className="text-muted-foreground">Your email address, a copy of your data, and deleting your account.</span>
        </span>
        <span aria-hidden className="text-muted-foreground">→</span>
      </Link>

      {showBilling ? (
        <Link
          href="/dashboard/settings/billing"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Billing</span>
            <span className="text-muted-foreground">Plans, the next payment and limits for this workspace.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showOrganisation ? (
        <Link
          href="/dashboard/settings/organisation"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Organisation</span>
            <span className="text-muted-foreground">
              {viewer?.workspace?.teaches ? "Your organisation teaches. Switch teaching off here." : "Your organisation doesn't teach."}
            </span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showMembers ? (
        <Link
          href="/dashboard/settings/members"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Members</span>
            <span className="text-muted-foreground">Invite tutors and admins, and see who&apos;s joined.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showPayouts ? (
        <Link
          href="/dashboard/settings/payouts"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Payouts</span>
            <span className="text-muted-foreground">The bank account parents&apos; fee payments go to.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {isRevampUi() ? <ThemeSetting initial={viewer?.user.theme ?? "CALM"} /> : null}

      <SettingsForm
        role={session.user.role}
        email={user.email}
        emailVerified={user.emailVerified !== null}
        defaults={defaults}
      />
    </div>
  );
}
