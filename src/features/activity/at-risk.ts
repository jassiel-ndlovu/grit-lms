/**
 * At-risk alerts for B's pages, over A's queries (features/risk/alerts).
 * Server only.
 */

import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { hasService } from "@/features/billing/services";
import { countOpenRiskAlerts, listRiskAlertsFor, listSharedRiskAlerts, type SharedRiskAlert, type StaffRiskAlert } from "@/features/risk/alerts";
import { prisma } from "@/lib/db";
import { can, canIn, courseScopeOf, scopedCourseWhere, type Viewer } from "@/lib/viewer";

import { sortAlerts, type AlertView } from "./lib/at-risk";

const SERVICE = "at-risk-alerts";

/** Staff who may see alerts at all (A narrows the list to their courses). */
export function seesAlerts(viewer: Viewer): boolean {
  return viewer.persona === "staff" && viewer.workspace !== null && can(viewer, "grades.view");
}

export type AlertRow = StaffRiskAlert & {
  /** "plan": the course isn't on Pro. "hidden": closed, or the person can't write to families. */
  share: "yes" | "plan" | "hidden";
};

/** The staff list for one view, every course the viewer may see grades for. */
export async function alertRows(viewer: Viewer, view: AlertView): Promise<AlertRow[]> {
  const alerts = await listRiskAlertsFor(viewer, { status: view, limit: 200 });
  const share = new Map<string, AlertRow["share"]>();
  if (view === "open") {
    for (const courseId of new Set(alerts.map((a) => a.course.id))) {
      if (!(await canIn(viewer, "messages.direct", { courseId }))) share.set(courseId, "hidden");
      else share.set(courseId, (await hasService(viewer, courseId, SERVICE)) ? "yes" : "plan");
    }
  }
  return sortAlerts(alerts, view).map((a) => ({ ...a, share: share.get(a.course.id) ?? "hidden" }));
}

/** Does any of the viewer's courses have alerts switched on? Every course does while billing is off. */
export async function alertsSwitchedOn(viewer: Viewer): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  const scope = courseScopeOf(viewer, "grades.view");
  const n = await prisma.course.count({
    where: {
      workspaceId: viewer.workspace?.id ?? "-",
      ...(scope ? scopedCourseWhere(scope) : {}),
      services: { some: { serviceKey: SERVICE, enabled: true } },
    },
  });
  return n > 0;
}

/** Open alerts per course, or nothing for someone who doesn't see them. */
export async function openAlertCounts(viewer: Viewer | null): Promise<Record<string, number>> {
  return viewer && seesAlerts(viewer) ? countOpenRiskAlerts(viewer) : {};
}

/** What staff shared with this student or parent; for one child when given. */
export async function notesFromTutors(viewer: Viewer | null, childUserId?: string): Promise<SharedRiskAlert[]> {
  if (!viewer) return [];
  const notes = await listSharedRiskAlerts(viewer);
  return childUserId ? notes.filter((n) => n.student.userId === childUserId) : notes;
}
