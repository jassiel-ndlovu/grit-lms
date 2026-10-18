/**
 * Server-side access to UserPreferences.
 *
 * A user has no preferences row until they first save settings, so every
 * read goes through `withDefaults`, which mirrors the Prisma column
 * defaults. Callers never have to handle a missing row.
 */

import "server-only";

import { cache } from "react";

import type { UserPreferences } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export type ResolvedPreferences = Omit<UserPreferences, "id" | "userId">;

export const DEFAULT_PREFERENCES: ResolvedPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  notificationFrequency: "IMMEDIATE",
  notifyOnCourseUpdate: true,
  notifyOnNewLesson: true,
  notifyOnNewTest: true,
  notifyOnDueDateReminder: true,
  notifyOnGrades: true,
  notifyOnMessages: true,
  darkMode: false,
  preferredLanguage: "EN",
  timeZone: null,
  preferredView: "GRID",
  studyReminders: false,
  defaultDashboardTab: "COURSES",
  notifyOnSubmissions: true,
  notifyOnGradingQueue: true,
  lastDigestSentAt: null,
};

export function withDefaults(
  row: UserPreferences | null | undefined,
): ResolvedPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, userId, ...rest } = row;
  return rest;
}

/** Preferences for one user, cached for the request. */
export const getUserPreferences = cache(async (userId: string) => {
  const row = await prisma.userPreferences.findUnique({ where: { userId } });
  return withDefaults(row);
});

/** Preferences for many users at once, keyed by userId. */
export async function getPreferencesForUsers(
  userIds: string[],
): Promise<Map<string, ResolvedPreferences>> {
  const rows =
    userIds.length > 0
      ? await prisma.userPreferences.findMany({
          where: { userId: { in: userIds } },
        })
      : [];
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  return new Map(userIds.map((id) => [id, withDefaults(byUser.get(id))]));
}
