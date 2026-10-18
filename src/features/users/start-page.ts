/**
 * "Start page" setting (UserPreferences.defaultDashboardTab): where a user
 * lands after signing in. The enum predates the setting, so COURSES means
 * the role's home page and GRADES means the tutor's gradebook.
 */

import type { DashboardTab, Role } from "@/features/shared/enums";

const PATHS: Record<Role, Partial<Record<DashboardTab, string>>> = {
  STUDENT: {
    COURSES: "/dashboard",
    NOTIFICATIONS: "/dashboard/notifications",
    CALENDAR: "/dashboard/calendar",
    GRADES: "/dashboard/grades",
  },
  TUTOR: {
    COURSES: "/dashboard",
    NOTIFICATIONS: "/dashboard/notifications",
    CALENDAR: "/dashboard/calendar",
    GRADES: "/dashboard/gradebook",
  },
  ADMIN: { COURSES: "/dashboard", NOTIFICATIONS: "/dashboard/notifications" },
  PARENT: { COURSES: "/dashboard", NOTIFICATIONS: "/dashboard/notifications" },
};

const LABELS: Record<DashboardTab, string> = {
  COURSES: "Home",
  NOTIFICATIONS: "Notifications",
  CALENDAR: "Schedule",
  GRADES: "Grades",
};

export function startPathFor(role: Role, tab: DashboardTab): string {
  return PATHS[role]?.[tab] ?? "/dashboard";
}

export function startPageOptions(role: Role): { value: DashboardTab; label: string }[] {
  return (Object.keys(PATHS[role] ?? {}) as DashboardTab[]).map((value) => ({
    value,
    label: role === "TUTOR" && value === "GRADES" ? "Gradebook" : LABELS[value],
  }));
}
