/**
 * /dashboard/settings — signed-in user preferences.
 *
 * Server Component. Reads (or creates on first visit) the user's
 * UserPreferences row and hands the current values to a client-side
 * SettingsForm. All writes flow through updateOwnPreferences.
 */

import Image from "next/image";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import {
  SettingsForm,
  type SettingsFormValues,
} from "@/features/users/components/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const email = session.user.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) redirect("/auth");

  // Ensure the preferences row exists so defaults line up. Upsert is
  // cheap and lets us assume presence downstream.
  const prefs = await prisma.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, timeZone: null },
    update: {},
  });

  const defaults: SettingsFormValues = {
    emailNotifications: prefs.emailNotifications,
    pushNotifications: prefs.pushNotifications,
    notificationFrequency: prefs.notificationFrequency as
      | "IMMEDIATE"
      | "DAILY"
      | "WEEKLY"
      | "NONE",
    notifyOnCourseUpdate: prefs.notifyOnCourseUpdate,
    notifyOnNewLesson: prefs.notifyOnNewLesson,
    notifyOnNewTest: prefs.notifyOnNewTest,
    notifyOnDueDateReminder: prefs.notifyOnDueDateReminder,
    notifyOnGrades: prefs.notifyOnGrades,
    notifyOnMessages: prefs.notifyOnMessages,
    darkMode: prefs.darkMode,
    preferredLanguage: prefs.preferredLanguage,
    timeZone: prefs.timeZone,
    preferredView: prefs.preferredView as "LIST" | "GRID" | "TIMELINE",
    studyReminders: prefs.studyReminders,
    defaultDashboardTab: prefs.defaultDashboardTab as
      | "COURSES"
      | "NOTIFICATIONS"
      | "CALENDAR"
      | "GRADES",
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
              Fine-tune notifications, appearance and defaults. Changes save
              when you click &ldquo;Save preferences&rdquo; at the bottom.
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

      <SettingsForm defaults={defaults} />
    </div>
  );
}
