/**
 * Changing an account's email (design 02, section 8).
 *
 *   1. requestEmailChangeFor: the user re-enters their password; a confirm
 *      link (1 hour) goes to the NEW address. One request per 2 minutes.
 *   2. confirmEmailChangeFor: the address changes, counts as verified, and
 *      every session ends. Unless the old address was a placeholder, it gets
 *      a "This wasn't me" link (7 days).
 *   3. revertEmailChangeFor: puts the old address back and ends every
 *      session, so whoever changed it is signed out.
 *
 * Works with either sign-in system: the password is checked against the
 * credential Account (bcrypt or scrypt) or User.password. Accounts without
 * a password (Google only) can't change their email here. Server only.
 */

import "server-only";

import { UserError } from "@/lib/user-error";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { verifyPassword } from "better-auth/crypto";

import { prisma } from "@/lib/db";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `password` is the user's current password. */
export async function checkPassword(userId: string, password: string): Promise<boolean> {
  const acc = await prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  for (const hash of [acc?.password, u?.password]) {
    if (!hash) continue;
    if (/^\$2[aby]\$/.test(hash) ? await bcrypt.compare(password, hash) : await verifyPassword({ hash, password }).catch(() => false)) return true;
  }
  return false;
}

export async function requestEmailChangeFor(userId: string, input: { password: string; newEmail: string }, now: Date = new Date()) {
  const newEmail = input.newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(newEmail) || newEmail.endsWith(".invalid")) throw new UserError("Enter a valid email address");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });
  if (u.email.toLowerCase() === newEmail) throw new UserError("That's already your email address");
  if (!(await checkPassword(userId, input.password))) throw new UserError("That password isn't right");
  if (await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })) throw new UserError("Another account uses that email address");
  const recent = await prisma.emailChangeRequest.findFirst({ where: { userId, createdAt: { gte: new Date(now.getTime() - 2 * 60 * 1000) } }, select: { id: true } });
  if (recent) throw new UserError("Wait a couple of minutes before asking again");

  const token = randomBytes(32).toString("base64url");
  const r = await prisma.emailChangeRequest.create({
    data: { userId, oldEmail: u.email, newEmail, confirmTokenHash: sha(token), expiresAt: new Date(now.getTime() + HOUR) },
    select: { id: true },
  });
  const key = `account:email-confirm:${r.id}`;
  await enqueueEmail(prisma, {
    key, template: "account:email-confirm", to: newEmail, userId, workspaceId: null, category: "ACCOUNT", priority: "AUTH",
    data: { name: u.name, tokenSealed: sealForQueue(token) },
  });
  await sendQueuedNow([key]);
  return { sentTo: newEmail };
}

export type ConfirmResult = { status: "changed"; email: string } | { status: "invalid" | "expired" | "taken" };

export async function confirmEmailChangeFor(token: string, now: Date = new Date()): Promise<ConfirmResult> {
  const r = await prisma.emailChangeRequest.findUnique({ where: { confirmTokenHash: sha(token) }, include: { user: { select: { name: true, emailIsPlaceholder: true } } } });
  if (!r || r.confirmedAt) return { status: "invalid" };
  if (r.expiresAt < now) return { status: "expired" };
  if (await prisma.user.findFirst({ where: { email: r.newEmail, id: { not: r.userId } }, select: { id: true } })) return { status: "taken" };
  const revert = randomBytes(32).toString("base64url");
  const notifyOld = !r.user.emailIsPlaceholder;
  const key = `account:email-changed:${r.id}`;
  await prisma.$transaction(async (tx) => {
    const won = await tx.emailChangeRequest.updateMany({ where: { id: r.id, confirmedAt: null }, data: { confirmedAt: now, ...(notifyOld ? { revertTokenHash: sha(revert), revertExpiresAt: new Date(now.getTime() + 7 * DAY) } : {}) } });
    if (won.count === 0) throw new UserError("Already confirmed");
    await tx.user.update({ where: { id: r.userId }, data: { email: r.newEmail, emailVerified: now, emailConfirmed: true, emailIsPlaceholder: false } });
    // Legacy profiles carry the email too (design 01, section 8).
    await tx.student.updateMany({ where: { userId: r.userId }, data: { email: r.newEmail } });
    await tx.tutor.updateMany({ where: { userId: r.userId }, data: { email: r.newEmail } });
    await tx.session.deleteMany({ where: { userId: r.userId } });
    await tx.auditLog.create({ data: { workspaceId: null, actorUserId: r.userId, action: "user.email_changed", targetType: "User", targetId: r.userId, data: { fromPlaceholder: !notifyOld } } });
    if (notifyOld) {
      await enqueueEmail(tx, {
        key, template: "account:email-changed", to: r.oldEmail, userId: r.userId, workspaceId: null, category: "ACCOUNT", priority: "AUTH",
        data: { name: r.user.name, newEmail: r.newEmail, tokenSealed: sealForQueue(revert) },
      });
    }
  }, { timeout: 30_000 });
  if (notifyOld) await sendQueuedNow([key]);
  return { status: "changed", email: r.newEmail };
}

/** "This wasn't me": the old address comes back and every session ends. */
export async function revertEmailChangeFor(token: string, now: Date = new Date()): Promise<{ status: "reverted" | "invalid" | "expired" | "taken" }> {
  const r = await prisma.emailChangeRequest.findUnique({ where: { revertTokenHash: sha(token) } });
  if (!r || r.revertedAt) return { status: "invalid" };
  if (!r.revertExpiresAt || r.revertExpiresAt < now) return { status: "expired" };
  if (await prisma.user.findFirst({ where: { email: r.oldEmail, id: { not: r.userId } }, select: { id: true } })) return { status: "taken" };
  await prisma.$transaction(async (tx) => {
    await tx.emailChangeRequest.update({ where: { id: r.id }, data: { revertedAt: now } });
    await tx.user.update({ where: { id: r.userId }, data: { email: r.oldEmail, emailVerified: now, emailConfirmed: true } });
    await tx.student.updateMany({ where: { userId: r.userId }, data: { email: r.oldEmail } });
    await tx.tutor.updateMany({ where: { userId: r.userId }, data: { email: r.oldEmail } });
    await tx.session.deleteMany({ where: { userId: r.userId } });
    await tx.auditLog.create({ data: { workspaceId: null, actorUserId: r.userId, action: "user.email_reverted", targetType: "User", targetId: r.userId, data: {} } });
  }, { timeout: 30_000 });
  return { status: "reverted" };
}
