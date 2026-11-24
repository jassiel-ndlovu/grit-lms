/**
 * Staff invites (design 02, section 5; ux/01, section 5). An owner or admin
 * invites by email as ADMIN or TUTOR (never OWNER), optionally onto
 * courses. The email carries a one-time link; only a hash of the token is
 * stored. Accepting needs the invited address: an existing account signs
 * in, a new person signs up with that email first. One pending invite per
 * workspace, email and kind (partial unique index). Expires after 7 days.
 * Server only.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { mayTeach } from "@/features/workspaces/teaching";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";

const DAY = 24 * 60 * 60 * 1000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function createStaffInvitesFor(
  actor: { userId: string; name: string },
  workspaceId: string,
  input: { emails: string[]; role: "ADMIN" | "TUTOR"; courseIds?: string[]; teamIds?: string[] },
  now: Date = new Date(),
) {
  const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0 || emails.length > 50) throw new UserError("Invite between 1 and 50 people at a time");
  const courseIds = input.courseIds ?? [];
  if (courseIds.length && (await prisma.course.count({ where: { id: { in: courseIds }, workspaceId } })) !== courseIds.length) throw new UserError("One of the courses isn't in this workspace");
  const teamIds = input.teamIds ?? [];
  if (teamIds.length && (await prisma.team.count({ where: { id: { in: teamIds }, workspaceId } })) !== teamIds.length) throw new UserError("One of the teams isn't in this workspace");
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, timezone: true } });
  const out: Array<{ email: string; status: "INVITED" | "ALREADY_MEMBER" | "RESENT" }> = [];
  const keys: string[] = [];
  for (const email of emails) {
    const member = await prisma.membership.findFirst({ where: { workspaceId, status: "ACTIVE", user: { email } }, select: { id: true } });
    if (member) {
      out.push({ email, status: "ALREADY_MEMBER" });
      continue;
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + 7 * DAY);
    const pending = await prisma.invite.findFirst({ where: { workspaceId, email, kind: "STAFF", acceptedAt: null, revokedAt: null }, select: { id: true } });
    const invite = pending
      ? await prisma.invite.update({ where: { id: pending.id }, data: { tokenHash: sha(token), expiresAt, role: input.role, ...(input.courseIds ? { courseIds } : {}), ...(input.teamIds ? { teamIds } : {}), invitedById: actor.userId }, select: { id: true } })
      : await prisma.invite.create({ data: { workspaceId, kind: "STAFF", email, tokenHash: sha(token), role: input.role, courseIds, teamIds, displayName: email, invitedById: actor.userId, expiresAt }, select: { id: true } });
    const key = `auth:invite:${invite.id}:${expiresAt.getTime()}`;
    await enqueueEmail(prisma, {
      key, template: "auth:invite", to: email, userId: null, workspaceId, category: "ACCOUNT", priority: "AUTH",
      data: {
        inviterName: actor.name, workspaceName: ws.name, role: input.role,
        expiresOn: new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: ws.timezone }).format(expiresAt),
        tokenSealed: sealForQueue(token),
      },
    });
    keys.push(key);
    await prisma.auditLog.create({ data: { workspaceId, actorUserId: actor.userId, action: "members.invite", targetType: "Invite", targetId: invite.id, data: { role: input.role, courses: courseIds.length, resent: !!pending } } });
    out.push({ email, status: pending ? "RESENT" : "INVITED" });
  }
  if (keys.length) await sendQueuedNow(keys);
  return out;
}

type InviteState = "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";
const stateOf = (i: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InviteState =>
  i.acceptedAt ? "ACCEPTED" : i.revokedAt ? "REVOKED" : i.expiresAt <= now ? "EXPIRED" : "PENDING";

/** What the invite page shows. Never the full email; never more than the workspace's name and logo. */
export async function inviteSummaryFor(token: string, now: Date = new Date()) {
  const i = await prisma.invite.findUnique({
    where: { tokenHash: sha(token) },
    select: { email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, workspace: { select: { name: true, logoUrl: true } }, invitedBy: { select: { name: true } } },
  });
  if (!i) return null;
  return { state: stateOf(i, now), workspaceName: i.workspace.name, workspaceLogoUrl: i.workspace.logoUrl, role: i.role, invitedBy: i.invitedBy.name, expiresAt: i.expiresAt.toISOString(), emailMasked: maskEmail(i.email) };
}

/** Accepts for the signed-in user, whose email must be the invited one. */
export async function acceptInviteFor(user: { id: string; email: string }, token: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const i = await tx.invite.findUnique({ where: { tokenHash: sha(token) } });
    if (!i) return { ok: false as const, reason: "INVALID" as const };
    const state = stateOf(i, now);
    if (state !== "PENDING") return { ok: false as const, reason: state };
    if (i.email !== user.email.toLowerCase()) return { ok: false as const, reason: "WRONG_ACCOUNT" as const, emailMasked: maskEmail(i.email) };
    const won = await tx.invite.updateMany({ where: { id: i.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: now, acceptedByUserId: user.id } });
    if (won.count === 0) return { ok: false as const, reason: "ACCEPTED" as const };
    const m = await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: i.workspaceId, userId: user.id } },
      create: { workspaceId: i.workspaceId, userId: user.id, role: i.role ?? "TUTOR", invitedById: i.invitedById },
      update: { status: "ACTIVE", role: i.role ?? "TUTOR" },
      select: { id: true },
    });
    // An admin joining an organisation that switched teaching off doesn't teach (#206).
    const teachIds = (await mayTeach(tx, m.id)) ? i.courseIds : [];
    for (const courseId of teachIds) {
      await tx.courseStaff.upsert({ where: { courseId_membershipId: { courseId, membershipId: m.id } }, create: { courseId, membershipId: m.id, role: "ASSISTANT" }, update: {} });
    }
    // Bulk onboarding (#216): join the teams the invitation names (teams deleted since are skipped).
    for (const teamId of i.teamIds) {
      const team = await tx.team.findFirst({ where: { id: teamId, workspaceId: i.workspaceId }, select: { id: true } });
      if (team) await tx.teamMember.upsert({ where: { teamId_membershipId: { teamId, membershipId: m.id } }, create: { teamId, membershipId: m.id }, update: {} });
    }
    // An invited tutor is staff: settle the role choice a fresh sign-up would otherwise see.
    await tx.user.updateMany({ where: { id: user.id, roleUnconfirmed: true }, data: { roleUnconfirmed: false, role: "TUTOR" } });
    await tx.auditLog.create({ data: { workspaceId: i.workspaceId, actorUserId: user.id, action: "members.join", targetType: "Membership", targetId: m.id, data: { inviteId: i.id, role: i.role } } });
    return { ok: true as const, workspaceId: i.workspaceId };
  }, { timeout: 30_000 });
}

export async function revokeInviteFor(actorUserId: string, workspaceId: string, inviteId: string) {
  const r = await prisma.invite.updateMany({ where: { id: inviteId, workspaceId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count === 0) throw new UserError("That invite is no longer pending");
  await prisma.auditLog.create({ data: { workspaceId, actorUserId, action: "members.invite.revoke", targetType: "Invite", targetId: inviteId, data: {} } });
  return { revoked: true as const };
}

export async function listInvitesFor(workspaceId: string, now: Date = new Date()) {
  const rows = await prisma.invite.findMany({
    where: { workspaceId, kind: "STAFF" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, email: true, role: true, courseIds: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true, invitedBy: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, courseIds: r.courseIds, invitedBy: r.invitedBy.name, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), state: stateOf(r, now) }));
}
