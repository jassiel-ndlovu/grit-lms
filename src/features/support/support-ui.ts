/**
 * Display helpers for the help centre (client-safe). Dates use the school's
 * time zone on both server and browser, so pages hydrate cleanly.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import { schoolDateFormat } from "@/lib/datetime";

import type { SupportRoute, SupportStatus } from "./support-rules";

export const supportRoutes = {
  help: "/dashboard/help",
  newQuery: "/dashboard/help/new",
  query: (id: string) => `/dashboard/help/${id}`,
  organisationInbox: "/dashboard/support",
  nexaInbox: "/dashboard/admin/support",
  publicHelp: "/support",
  publicQuery: (token: string) => `/support/q/${token}`,
} as const;

export const STATUS_TONE: Record<SupportStatus, StatusTone> = {
  OPEN: "warning",
  ANSWERED: "info",
  CLOSED: "neutral",
};

/** For the requester: who will answer. */
export function routeLabel(route: SupportRoute, organisationName: string | null): string {
  return route === "NEXA" ? "Nexa support" : organisationName ?? "Your tutor or school";
}

const dayMonth = schoolDateFormat({ day: "numeric", month: "short" });
const dayMonthYear = schoolDateFormat({ day: "numeric", month: "short", year: "numeric" });
const time = schoolDateFormat({ hour: "2-digit", minute: "2-digit" });

/** "Today, 14:05", "Yesterday, 09:12", "3 Nov" or "3 Nov 2025". */
export function whenLabel(value: Date | string, now: Date = new Date()): string {
  const d = new Date(value);
  const sameDay = dayMonthYear.format(d) === dayMonthYear.format(now);
  if (sameDay) return `Today, ${time.format(d)}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (dayMonthYear.format(d) === dayMonthYear.format(yesterday)) return `Yesterday, ${time.format(d)}`;
  return d.getFullYear() === now.getFullYear() ? dayMonth.format(d) : dayMonthYear.format(d);
}

/** Server-action errors in words people can act on. */
export function supportErrorMessage(serverError: string | null | undefined, fallback = "That didn't work. Check your connection and try again."): string {
  if (!serverError) return fallback;
  if (/access to do that/i.test(serverError)) return "You can't open this query. It may belong to someone else, or it was moved.";
  return serverError;
}
