/**
 * Whether an organisation teaches (owner decision 2026-11-21, #206).
 *
 * An organisation that teaches has the organisation/tutor mode switch, and
 * its owners and admins who teach are listed as tutors. Switching teaching
 * off is strict: only an owner can do it, they type the organisation's name
 * to confirm, it's audited, and only a Nexa admin can switch it back on.
 * While it's off, owners and admins never become course staff, so they
 * don't teach and aren't listed as tutors. Plain tutors keep teaching.
 *
 * A solo workspace always teaches. Server only; takes ids so scripts can
 * test it.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export class TeachingError extends UserError {
  constructor(message: string) {
    super(message);
    this.name = "TeachingError";
  }
}

/** True when this membership may be course staff: always, unless it's an owner or admin of an organisation that switched teaching off. */
export async function mayTeach(tx: Tx | typeof prisma, membershipId: string): Promise<boolean> {
  const m = await tx.membership.findUnique({
    where: { id: membershipId },
    select: { role: true, workspace: { select: { kind: true, teachingOffAt: true } } },
  });
  if (!m) return false;
  if (m.role === "TUTOR" || m.workspace.kind === "SOLO") return true;
  return m.workspace.teachingOffAt == null;
}

/**
 * Switches teaching off for an organisation. The caller must be its OWNER
 * and type its name. Refused while any owner or admin still teaches a
 * course: hand those courses to a tutor first.
 */
export async function switchTeachingOffFor(workspaceId: string, actorUserId: string, confirmName: string, now: Date = new Date()) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { kind: true, name: true, teachingOffAt: true } });
  if (ws.kind !== "ORGANISATION") throw new TeachingError("A solo practice always teaches.");
  if (ws.teachingOffAt) return { teaches: false as const, since: ws.teachingOffAt.toISOString() };
  const owner = await prisma.membership.findFirst({ where: { workspaceId, userId: actorUserId, role: "OWNER", status: "ACTIVE" }, select: { id: true } });
  if (!owner) throw new TeachingError("Only an owner can switch teaching off.");
  if (confirmName.trim().toLowerCase() !== ws.name.trim().toLowerCase()) {
    throw new TeachingError("Type the organisation's name exactly to confirm.");
  }
  const stillTeaching = await prisma.courseStaff.findMany({
    where: { membership: { workspaceId, role: { in: ["OWNER", "ADMIN"] } }, course: { workspaceId } },
    select: { course: { select: { name: true } } },
    distinct: ["courseId"],
    take: 6,
  });
  if (stillTeaching.length) {
    const names = stillTeaching.slice(0, 5).map((s) => s.course.name).join(", ");
    throw new TeachingError(`Owners and admins still teach ${stillTeaching.length > 5 ? "these and more courses" : "these courses"}: ${names}. Hand them to a tutor first.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: workspaceId }, data: { teachingOffAt: now, teachingOffById: actorUserId } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "workspace.teaching_off", targetType: "Workspace", targetId: workspaceId, data: {} } });
  }, { timeout: 30_000 });
  return { teaches: false as const, since: now.toISOString() };
}

/** Nexa admin only (the caller checks admin.override): switches teaching back on, with a note. */
export async function switchTeachingOnFor(actor: { userId: string; impersonatorUserId: string | null }, input: { workspaceId: string; note: string }) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { teachingOffAt: true } });
  if (!ws.teachingOffAt) return { teaches: true as const };
  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: input.workspaceId }, data: { teachingOffAt: null, teachingOffById: null } });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId, actorUserId: actor.userId, impersonatorUserId: actor.impersonatorUserId,
        action: "admin.workspace.teaching_on", targetType: "Workspace", targetId: input.workspaceId,
        data: { note: input.note, offSince: ws.teachingOffAt!.toISOString() },
      },
    });
  }, { timeout: 30_000 });
  return { teaches: true as const };
}
