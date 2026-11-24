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
import { DataSaverSetting } from "@/components/settings/data-saver-setting";
import { ReadingSetting } from "@/components/settings/reading-setting";
import { MeetingProviderSetting } from "@/features/events/components/meeting-provider-setting";
import HeaderSettings from "@/components/illustrations/generated/header-settings";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";

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
  const showMembers = viewer?.workspace != null && (can(viewer, "members.invite") || can(viewer, "members.role"));
  // Roles, branches and teams (viewer.md, "Roles and branches"): an organisation's staff.
  const inOrganisation = viewer?.persona === "staff" && viewer.workspace?.kind === "ORGANISATION";
  const showRoles = inOrganisation && can(viewer, "members.role");
  const showBranches = inOrganisation && (can(viewer, "teams.manage") || can(viewer, "members.role"));
  // The teaching switch (#206): organisations, for owners and admins.
  const showOrganisation = viewer?.workspace?.kind === "ORGANISATION" && can(viewer, "workspace.settings");
  // The meeting app (#211): any workspace, for owners and admins.
  const showMeetings = viewer?.workspace != null && can(viewer, "workspace.settings");
  const showBranding = viewer?.workspace != null && can(viewer, "workspace.branding");
  const showDevelopers = viewer?.workspace != null && can(viewer, "workspace.settings");
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
    <PageFrame type="settings" breadcrumb={[{ label: "Settings" }]}>
      <PageTitle
        eyebrow="Preferences"
        title="Settings"
        description="Choose what you hear about, how the app looks and where you land. Changes apply when you click “Save preferences”."
        illustration={<HeaderSettings />}
      />

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
            <span className="text-muted-foreground">Plans, the next payment and limits for this organisation.</span>
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
            <span className="text-muted-foreground">Invite people, change their roles, and see who&apos;s joined.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showRoles ? (
        <Link
          href="/dashboard/settings/roles"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Roles</span>
            <span className="text-muted-foreground">What each role can do, and roles of your own.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showBranches ? (
        <Link
          href="/dashboard/settings/branches"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Branches and teams</span>
            <span className="text-muted-foreground">The parts of your organisation, and who and what is in them.</span>
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

      {showBranding ? (
        <Link
          href="/dashboard/settings/branding"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">Branding</span>
            <span className="text-muted-foreground">Your logo, colour and name on families&apos; emails and your sign-in page.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showDevelopers ? (
        <Link
          href="/dashboard/settings/developers"
          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 text-sm"
        >
          <span>
            <span className="text-foreground block font-semibold">API and webhooks</span>
            <span className="text-muted-foreground">Connect Nexa to your other systems: read-only API keys, and webhooks that tell them when things happen.</span>
          </span>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>
      ) : null}

      {showMeetings ? <MeetingProviderSetting initial={viewer?.workspace?.meetingProvider ?? "GOOGLE_MEET"} /> : null}

      {isRevampUi() ? <ThemeSetting initial={viewer?.user.theme ?? "CALM"} /> : null}
      <ReadingSetting initial={{ textSize: viewer?.user.textSize ?? "DEFAULT", readingFont: viewer?.user.readingFont ?? "DEFAULT" }} />
      <DataSaverSetting />

      <SettingsForm
        role={session.user.role}
        email={user.email}
        emailVerified={user.emailVerified !== null}
        defaults={defaults}
      />
    </PageFrame>
  );
}
