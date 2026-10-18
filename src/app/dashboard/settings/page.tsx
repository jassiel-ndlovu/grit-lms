/**
 * /dashboard/settings — signed-in user preferences.
 *
 * Server Component. Reads the user's UserPreferences (defaults if they
 * have never saved) and hands the current values to a client-side
 * SettingsForm, which shows only the options relevant to the user's role.
 * All writes flow through updateOwnPreferences.
 */

import Image from "next/image";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  SettingsForm,
  type SettingsFormValues,
} from "@/features/users/components/settings-form";
import { getUserPreferences } from "@/features/users/preferences";
import { resolveLocale } from "@/lib/datetime";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user) redirect("/auth");

  const prefs = await getUserPreferences(session.user.id);
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
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">
              Preferences
            </p>
            <h1 className="font-display mt-1 text-3xl leading-tight tracking-tight">
              Settings
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Choose what you hear about, how the app looks and where you
              land. Changes apply when you click &ldquo;Save preferences&rdquo;.
            </p>
          </div>
          <div className="relative hidden h-32 w-40 shrink-0 md:block">
            <Image
              src="/illustrations/smart-work-efficiency.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <SettingsForm
        role={session.user.role}
        email={user.email}
        emailVerified={user.emailVerified !== null}
        defaults={defaults}
      />
    </div>
  );
}
