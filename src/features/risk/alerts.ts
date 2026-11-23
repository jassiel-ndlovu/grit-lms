/**
 * At-risk alerts for people (#216 phase 2, Pro). Staff list, share, dismiss
 * and close them; students and parents see only what was shared with them.
 * Actions: ./actions.ts. Contract: viewer.md, "At-risk alerts".
 */

import "server-only";

import { hasService } from "@/features/billing/services";
import { emitNotification } from "@/features/notifications/server";
import { getPreferencesForUsers } from "@/features/users/preferences";
import type { RiskAlertStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import type { RiskSharedData } from "@/lib/email/risk-templates";
import { UserError } from "@/lib/user-error";
import { canIn, ViewerError, type Viewer } from "@/lib/viewer";
import { courseScopeOf, scopedCourseWhere } from "@/lib/viewer-core";

import { RISK_RULES, type RiskLevel, type RiskReason } from "./rules";

const DAY = 86_400_000;
export const RISK_UPSELL = "At-risk alerts are part of the Pro plan for this course.";

export type StaffRiskAlert = {
  id: string;
  course: { id: string; name: string };
  student: { userId: string; name: string };
  level: RiskLevel;
  status: RiskAlertStatus;
  reasons: RiskReason[];
  summary: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sharedAt: Date | null;
  sharedWith: string[];
  shareNote: string | null;
  closedAt: Date | null;
  /** Who it can be shared with right now (closed alerts: nobody). */
  canShareWith: { guardians: number; student: boolean };
};

type Person = { id: string; name: string; email: string };

/** Parents with a confirmed email, and the student if their own email is confirmed. */
export async function recipientsFor(studentUserId: string): Promise<{ guardians: Person[]; student: Person | null }> {
  const [links, student] = await Promise.all([
    prisma.guardianship.findMany({
      where: {
        studentUserId,
        status: "ACTIVE",
        guardian: { deletedAt: null, deletionRequestedAt: null, emailIsPlaceholder: false, OR: [{ emailVerified: { not: null } }, { emailConfirmed: true }] },
      },
      select: { guardian: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findUnique({
      where: { id: studentUserId },
      select: { id: true, name: true, email: true, emailIsPlaceholder: true, emailVerified: true, emailConfirmed: true, deletedAt: true },
    }),
  ]);
  const studentOk = !!student && !student.deletedAt && !student.emailIsPlaceholder && (student.emailVerified != null || student.emailConfirmed);
  return { guardians: links.map((l) => l.guardian), student: studentOk ? { id: student.id, name: student.name, email: student.email } : null };
}

/**
 * Staff list: open alerts (OPEN and SHARED) by default, in the courses the
 * viewer may see grades for. AT_RISK first, then the most recently seen.
 */
export async function listRiskAlertsFor(
  viewer: Viewer,
  input: { courseId?: string; status?: "open" | "closed" | "all"; limit?: number },
): Promise<StaffRiskAlert[]> {
  const ws = viewer.workspace;
  if (!ws) throw new ViewerError("FORBIDDEN");
  if (input.courseId && !(await canIn(viewer, "grades.view", { courseId: input.courseId }))) throw new ViewerError("FORBIDDEN");
  const scope = courseScopeOf(viewer, "grades.view");
  const status = input.status ?? "open";
  const rows = await prisma.riskAlert.findMany({
    where: {
      workspaceId: ws.id,
      ...(input.courseId ? { courseId: input.courseId } : {}),
      ...(scope ? { course: scopedCourseWhere(scope) } : {}),
      ...(status === "open" ? { openKey: { not: null } } : status === "closed" ? { openKey: null } : {}),
    },
    orderBy: [{ level: "desc" }, { lastSeenAt: "desc" }],
    take: Math.min(Math.max(input.limit ?? 100, 1), 200),
    select: {
      id: true, studentUserId: true, level: true, status: true, reasons: true, summary: true, firstSeenAt: true, lastSeenAt: true,
      sharedAt: true, sharedWith: true, shareNote: true, closedAt: true, openKey: true, course: { select: { id: true, name: true } },
    },
  });
  const users = new Map(
    (await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentUserId))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );
  const out: StaffRiskAlert[] = [];
  for (const r of rows) {
    const rec = r.openKey ? await recipientsFor(r.studentUserId) : { guardians: [], student: null };
    out.push({
      id: r.id,
      course: r.course,
      student: { userId: r.studentUserId, name: users.get(r.studentUserId) ?? "Student" },
      level: r.level,
      status: r.status,
      reasons: r.reasons as unknown as RiskReason[],
      summary: r.summary,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      sharedAt: r.sharedAt,
      sharedWith: r.sharedWith,
      shareNote: r.shareNote,
      closedAt: r.closedAt,
      canShareWith: { guardians: rec.guardians.length, student: !!rec.student },
    });
  }
  return out;
}

/** Open alerts per course id, for badges on course cards. */
export async function countOpenRiskAlerts(viewer: Viewer): Promise<Record<string, number>> {
  if (!viewer.workspace) return {};
  const scope = courseScopeOf(viewer, "grades.view");
  const rows = await prisma.riskAlert.groupBy({
    by: ["courseId"],
    where: { workspaceId: viewer.workspace.id, openKey: { not: null }, ...(scope ? { course: scopedCourseWhere(scope) } : {}) },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.courseId, r._count]));
}

async function loadForStaff(viewer: Viewer, alertId: string, permission: "grades.view" | "messages.direct") {
  const a = await prisma.riskAlert.findUnique({
    where: { id: alertId },
    select: {
      id: true, workspaceId: true, courseId: true, studentUserId: true, openKey: true, status: true, summary: true,
      course: { select: { name: true } }, workspace: { select: { name: true } },
    },
  });
  if (!a || a.workspaceId !== viewer.workspace?.id) throw new UserError("That alert no longer exists.");
  if (!(await canIn(viewer, "grades.view", { courseId: a.courseId }))) throw new ViewerError("FORBIDDEN");
  if (permission !== "grades.view" && !(await canIn(viewer, permission, { courseId: a.courseId }))) throw new ViewerError("FORBIDDEN");
  return a;
}

/**
 * Shares an open alert: an email and an in-app notice to the student's
 * parents and/or the student, with the staff member's note and the summary.
 * Pro only. Sharing again sends again (say, after it got worse).
 */
export async function shareRiskAlert(
  viewer: Viewer,
  input: { alertId: string; withGuardians: boolean; withStudent: boolean; note?: string | null },
): Promise<{ ok: true; sentTo: number; emailed: number }> {
  const a = await loadForStaff(viewer, input.alertId, "messages.direct");
  if (!a.openKey) throw new UserError("This alert is closed, so there's nothing to share.");
  if (!(await hasService(viewer, a.courseId, "at-risk-alerts"))) throw new UserError(RISK_UPSELL);
  if (!input.withGuardians && !input.withStudent) throw new UserError("Choose who to share it with.");
  const rec = await recipientsFor(a.studentUserId);
  const to = [
    ...(input.withGuardians ? rec.guardians.map((g) => ({ ...g, audience: "parent" as const })) : []),
    ...(input.withStudent && rec.student ? [{ ...rec.student, audience: "student" as const }] : []),
  ];
  if (!to.length) {
    throw new UserError(
      input.withGuardians && !rec.guardians.length
        ? "This student has no linked parent with a confirmed email yet."
        : "This student has no confirmed email address.",
    );
  }
  const student = await prisma.user.findUnique({ where: { id: a.studentUserId }, select: { name: true } });
  const note = input.note?.trim() ? input.note.trim().slice(0, 1000) : null;
  const now = new Date();
  const prefs = await getPreferencesForUsers(to.map((t) => t.id));
  const keys: string[] = [];
  for (const r of to) {
    if (prefs.get(r.id)?.emailNotifications === false) continue;
    const key = `risk:shared:${a.id}:${r.id}:${now.getTime()}`;
    keys.push(key);
    await enqueueEmail(prisma, {
      key,
      template: "risk:shared",
      to: r.email,
      userId: r.id,
      workspaceId: a.workspaceId,
      category: "risk",
      data: {
        recipientName: r.name,
        audience: r.audience,
        studentName: student?.name ?? "",
        courseName: a.course.name,
        workspaceName: a.workspace.name,
        tutorName: viewer.user.name,
        note,
        summary: a.summary,
      } satisfies RiskSharedData,
    });
  }
  await emitNotification(
    {
      title: `A note from ${viewer.user.name} about ${a.course.name}`.slice(0, 200),
      message: note ? `${note}\n\n${a.summary}` : a.summary,
      type: "SYSTEM",
      userIds: to.map((t) => t.id),
      courseId: a.courseId,
      link: "/dashboard",
    },
    { revalidate: false, email: false },
  ).catch((e) => console.error("[risk] share notice failed:", e));
  await sendQueuedNow(keys).catch(() => undefined);
  const sharedWith = [
    ...(input.withGuardians && rec.guardians.length ? ["GUARDIANS"] : []),
    ...(input.withStudent && rec.student ? ["STUDENT"] : []),
  ];
  await prisma.riskAlert.update({
    where: { id: a.id },
    data: { status: "SHARED", sharedAt: now, sharedByUserId: viewer.user.id, sharedWith, shareNote: note, sharedSummary: a.summary },
  });
  return { ok: true, sentTo: to.length, emailed: keys.length };
}

/** "Not a concern": closes it and keeps it quiet for RISK_RULES.quietDays. */
export async function dismissRiskAlert(viewer: Viewer, input: { alertId: string }) {
  const a = await loadForStaff(viewer, input.alertId, "grades.view");
  if (!a.openKey) return { ok: true as const };
  const now = new Date();
  await prisma.riskAlert.update({
    where: { id: a.id },
    data: { status: "DISMISSED", openKey: null, closedAt: now, closedByUserId: viewer.user.id, quietUntil: new Date(now.getTime() + RISK_RULES.quietDays * DAY) },
  });
  return { ok: true as const };
}

/** "Sorted": closes it. A new alert opens if the rules fire again. */
export async function resolveRiskAlert(viewer: Viewer, input: { alertId: string }) {
  const a = await loadForStaff(viewer, input.alertId, "grades.view");
  if (!a.openKey) return { ok: true as const };
  await prisma.riskAlert.update({ where: { id: a.id }, data: { status: "RESOLVED", openKey: null, closedAt: new Date(), closedByUserId: viewer.user.id } });
  return { ok: true as const };
}

export type SharedRiskAlert = {
  id: string;
  course: { id: string; name: string };
  student: { userId: string; name: string };
  summary: string;
  note: string | null;
  sharedAt: Date;
  sharedBy: string | null;
  open: boolean;
};

/** For a student (their own) or a parent (their children's): only what staff shared with them, in the last 90 days. */
export async function listSharedRiskAlerts(viewer: Viewer): Promise<SharedRiskAlert[]> {
  const since = new Date(Date.now() - 90 * DAY);
  let studentIds: string[] = [];
  let audience: "STUDENT" | "GUARDIANS" | null = null;
  if (viewer.persona === "learner") {
    studentIds = [viewer.user.id];
    audience = "STUDENT";
  } else if (viewer.persona === "guardian") {
    const kids = await prisma.guardianship.findMany({ where: { guardianUserId: viewer.user.id, status: "ACTIVE" }, select: { studentUserId: true } });
    studentIds = kids.map((k) => k.studentUserId);
    audience = "GUARDIANS";
  }
  if (!audience || !studentIds.length) return [];
  const rows = await prisma.riskAlert.findMany({
    where: { studentUserId: { in: studentIds }, sharedWith: { has: audience }, sharedAt: { gte: since } },
    orderBy: { sharedAt: "desc" },
    take: 50,
    select: {
      id: true, studentUserId: true, sharedSummary: true, summary: true, shareNote: true, sharedAt: true, sharedByUserId: true, openKey: true,
      course: { select: { id: true, name: true } },
    },
  });
  const ids = [...new Set(rows.flatMap((r) => [r.studentUserId, r.sharedByUserId ?? ""]).filter(Boolean))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    course: r.course,
    student: { userId: r.studentUserId, name: users.get(r.studentUserId) ?? "" },
    summary: r.sharedSummary ?? r.summary,
    note: r.shareNote,
    sharedAt: r.sharedAt!,
    sharedBy: r.sharedByUserId ? (users.get(r.sharedByUserId) ?? null) : null,
    open: !!r.openKey,
  }));
}
