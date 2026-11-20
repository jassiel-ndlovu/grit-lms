/** The role choice itself (see ./choose-role.ts). Server only; takes the user so scripts can test it. */

import "server-only";

import { prisma } from "@/lib/db";

export type ChosenRole = "TUTOR" | "STUDENT" | "PARENT";

/** Sets the role once. False when the user's role was already confirmed. */
export async function chooseRoleFor(userId: string, role: ChosenRole): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const won = await tx.user.updateMany({ where: { id: userId, roleUnconfirmed: true }, data: { role, roleUnconfirmed: false } });
    if (won.count === 0) return false;
    if (role === "STUDENT") {
      // So a tutor can add them to courses (B's forms pick Student profiles).
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });
      const existing = await tx.student.findFirst({ where: { OR: [{ userId }, { email: u.email.toLowerCase() }] }, select: { id: true, userId: true } });
      if (!existing) await tx.student.create({ data: { fullName: u.name, email: u.email.toLowerCase(), userId } });
      else if (!existing.userId) await tx.student.update({ where: { id: existing.id }, data: { userId } });
    }
    await tx.auditLog.create({ data: { workspaceId: null, actorUserId: userId, action: "user.role.choose", targetType: "User", targetId: userId, data: { role } } });
    return true;
  }, { timeout: 30_000 });
}
