/**
 * Bulk onboarding of an organisation, branch by branch (#216 phase 3).
 * Contract: viewer.md, "Bulk onboarding".
 *
 * The order: branches and teams (import "branches"), then staff (import
 * "staff", with a Teams column), courses (B's screens), students (import
 * "students") and the calendar (import "calendar"). Each branch moves
 * PLANNED → PILOT → LIVE; the checklist below says what's done per branch
 * and for the organisation. Nexa admins see every organisation's progress.
 */

import "server-only";

import { planAtLeast, workspacePlan } from "@/features/billing/workspace-plan";
import type { BranchRollout } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { orgChecklist, branchProgress, type BranchCounts } from "./onboarding-rules";

/** Counts for one branch's teams: staff (joined and invited), courses, students and calendar events. */
async function branchCounts(workspaceId: string, branchId: string): Promise<BranchCounts> {
  const teams = await prisma.team.findMany({ where: { workspaceId, branchId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);
  const [staff, invited, courses, students, events] = await Promise.all([
    prisma.teamMember.count({ where: { teamId: { in: teamIds }, membership: { status: "ACTIVE" } } }),
    prisma.invite.count({ where: { workspaceId, kind: "STAFF", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, teamIds: { hasSome: teamIds.length ? teamIds : ["-"] } } }),
    prisma.course.count({ where: { teamId: { in: teamIds } } }),
    prisma.enrollment.count({ where: { endedAt: null, course: { teamId: { in: teamIds } } } }),
    prisma.courseEvent.count({ where: { course: { teamId: { in: teamIds } } } }),
  ]);
  return { teams: teams.length, staff, invited, courses, students, events };
}

/** The organisation's onboarding: organisation-wide steps and each branch's progress. Owners and admins. */
export async function onboardingStatus(viewer: Viewer) {
  if (!viewer.workspace || !can(viewer, "teams.manage")) throw new ViewerError("FORBIDDEN");
  return onboardingFor(viewer.workspace.id);
}

export async function onboardingFor(workspaceId: string) {
  const [ws, branches, plan, payout, fees, importJobs] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, kind: true, logoUrl: true, senderName: true, enquiryFormOn: true, billingState: true, trialEndsAt: true, createdAt: true } }),
    prisma.branch.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, rollout: true, rolloutAt: true } }),
    workspacePlan(workspaceId),
    prisma.payoutAccount.count({ where: { workspaceId } }),
    prisma.feeSchedule.count({ where: { workspaceId, active: true } }),
    prisma.importJob.groupBy({ by: ["kind"], where: { workspaceId, status: "DONE" }, _count: true }),
  ]);
  const rows = [];
  for (const b of branches) {
    const counts = await branchCounts(workspaceId, b.id);
    rows.push({ id: b.id, name: b.name, rollout: b.rollout, rolloutAt: b.rolloutAt, counts, progress: branchProgress(counts) });
  }
  const imported = new Set(importJobs.map((j) => j.kind));
  return {
    name: ws.name,
    plan,
    checklist: orgChecklist({
      branches: branches.length,
      brand: !!ws.logoUrl || !!ws.senderName,
      brandAllowed: planAtLeast(plan, "PLUS"),
      payout: payout > 0,
      fees: fees > 0,
      enquiryForm: ws.enquiryFormOn,
      staffImported: imported.has("staff"),
      studentsImported: imported.has("students"),
      calendarImported: imported.has("calendar"),
    }),
    branches: rows,
    live: rows.filter((r) => r.rollout === "LIVE").length,
  };
}

/** Moves a branch through PLANNED → PILOT → LIVE (or back). Owners and admins. */
export async function setBranchRollout(viewer: Viewer, input: { branchId: string; rollout: BranchRollout }) {
  if (!viewer.workspace || !can(viewer, "teams.manage") || viewer.membership?.scope === "BRANCHES") throw new ViewerError("FORBIDDEN");
  const b = await prisma.branch.findFirst({ where: { id: input.branchId, workspaceId: viewer.workspace.id }, select: { id: true, rollout: true } });
  if (!b) throw new UserError("That branch no longer exists.");
  if (input.rollout === "LIVE") {
    const c = await branchCounts(viewer.workspace.id, b.id);
    if (!c.staff || !c.courses) throw new UserError("A branch goes live once it has staff and at least one course.");
  }
  await prisma.branch.update({ where: { id: b.id }, data: { rollout: input.rollout, rolloutAt: new Date() } });
  await prisma.auditLog.create({ data: { workspaceId: viewer.workspace.id, actorUserId: viewer.user.id, action: "branch.rollout", targetType: "Branch", targetId: b.id, data: { from: b.rollout, to: input.rollout } } });
  return { ok: true as const };
}

/** Nexa admins: every organisation's onboarding at a glance, newest first. */
export async function adminOnboardingOverview(viewer: Viewer, input: { limit?: number }) {
  if (viewer.persona !== "admin" || !can(viewer, "admin.console")) throw new ViewerError("FORBIDDEN");
  const orgs = await prisma.workspace.findMany({ where: { kind: "ORGANISATION", billingState: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(input.limit ?? 50, 1), 200), select: { id: true } });
  const out = [];
  for (const o of orgs) {
    const s = await onboardingFor(o.id);
    out.push({ workspaceId: o.id, name: s.name, plan: s.plan, branches: s.branches.length, live: s.live, pilot: s.branches.filter((b) => b.rollout === "PILOT").length, checklistDone: s.checklist.filter((c) => c.done).length, checklistTotal: s.checklist.length });
  }
  return out;
}
