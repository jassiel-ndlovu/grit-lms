/**
 * At-risk alert screens: routes, labels and wording (viewer.md Draft 1.20).
 * Pure. The rules, the summary and the actions are A's (features/risk).
 */

import type { StatusTone } from "@/components/shell/status-chip";
import type { RiskLevel, RiskReason } from "@/features/risk/rules";

export type AlertView = "open" | "closed";

export const atRiskRoutes = {
  list: "/dashboard/at-risk",
  view(view: AlertView, courseId?: string | null): string {
    const q = new URLSearchParams();
    if (view === "closed") q.set("status", "closed");
    if (courseId) q.set("course", courseId);
    const s = q.toString();
    return s ? `${this.list}?${s}` : this.list;
  },
};

/** `?status=`; anything but "closed" is the open list. */
export function parseAlertView(raw: string | string[] | undefined): AlertView {
  return raw === "closed" ? "closed" : "open";
}

export const LEVEL_CHIP: Record<RiskLevel, { label: string; tone: StatusTone }> = {
  AT_RISK: { label: "At risk", tone: "danger" },
  WATCH: { label: "Watch", tone: "warning" },
};

/** RESOLVED is closed by a person ("Sorted") or by the rules no longer firing; the list can't tell which. */
export const CLOSED_LABEL: Record<string, string> = { RESOLVED: "Sorted", DISMISSED: "Not a concern" };

export const REASON_LABEL: Record<RiskReason["rule"], string> = {
  FALLING_MARKS: "Falling marks",
  LOW_MARKS: "Low marks",
  MISSED_WORK: "Missed work",
  ABSENCES: "Absences",
};

/** Each kind of reason once, in the order they came. */
export function reasonRules(reasons: readonly RiskReason[]): RiskReason["rule"][] {
  return [...new Set(reasons.map((r) => r.rule))].filter((r) => r in REASON_LABEL);
}

export const SHARE_NOTE_MAX = 1000;

/** "the parents", "the student", "the parents and the student", or null when never shared. */
export function sharedWithLabel(sharedWith: readonly string[]): string | null {
  const who = [sharedWith.includes("GUARDIANS") ? "the parents" : null, sharedWith.includes("STUDENT") ? "the student" : null].filter(Boolean);
  return who.length ? who.join(" and ") : null;
}

/** Why there is nobody to share with, or null when there is. */
export function nobodyToShareWith(to: { guardians: number; student: boolean }): string | null {
  return to.guardians > 0 || to.student ? null : "No linked parent or student has a confirmed email yet.";
}

/** The toast after sharing. Someone with email off sees it in the app only. */
export function sharedToast(r: { sentTo: number; emailed: number }): string {
  const people = `Shared with ${r.sentTo} ${r.sentTo === 1 ? "person" : "people"}.`;
  const appOnly = r.sentTo - r.emailed;
  return appOnly > 0 ? `${people} ${appOnly === 1 ? "One has" : `${appOnly} have`} email off and will see it in Nexa.` : people;
}

/** Open alerts keep A's order (at risk first); closed ones, the last closed first. */
export function sortAlerts<T extends { closedAt: Date | null }>(rows: readonly T[], view: AlertView): T[] {
  return view === "open" ? [...rows] : [...rows].sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
}

/** The courses in a list of alerts, by name, for the filter. */
export function alertCourses(rows: readonly { course: { id: string; name: string } }[]): { id: string; name: string; count: number }[] {
  const by = new Map<string, { id: string; name: string; count: number }>();
  for (const { course } of rows) {
    const seen = by.get(course.id);
    if (seen) seen.count += 1;
    else by.set(course.id, { ...course, count: 1 });
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Sum of countRiskAlerts, over every course or one. */
export function totalAlerts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((n, c) => n + c, 0);
}
