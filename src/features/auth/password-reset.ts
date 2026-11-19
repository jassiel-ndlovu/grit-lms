/**
 * Password reset by emailed link.
 *
 * `requestPasswordReset(email)` answers the same way whether or not the
 * address has an account, so the form can't be used to find out who is a
 * user. For a real account it stores a SHA-256 of a random token (1 hour)
 * and queues the link (AUTH priority, tried at once; the raw token is sealed
 * in the queue row and removed after sending). At most one request per
 * account every 2 minutes.
 *
 * `resetPassword(token, newPassword)` checks the token, sets the new
 * password and spends every outstanding reset token of that user. Reset on
 * a button press, never on page load, because mail scanners open links.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const THROTTLE_MS = 2 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

export const PASSWORD_MIN = 10;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A password strong enough to accept: at least 10 characters, not all one kind. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 200) return "That password is too long.";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 2) return "Mix letters with numbers or symbols.";
  return null;
}

/** Always resolves the same; sends a link only to a real account. */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) return;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - THROTTLE_MS) } },
    select: { id: true },
  });
  if (recent) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  const key = `auth:reset:${user.id}:${hashToken(token).slice(0, 16)}`;
  await enqueueEmail(prisma, {
    key,
    template: "auth:reset",
    to: user.email,
    userId: user.id,
    category: "ACCOUNT",
    priority: "AUTH",
    data: { name: user.name, tokenSealed: sealForQueue(token) },
  });
  await sendQueuedNow([key]);
}

export type ResetResult = { status: "reset"; email: string } | { status: "invalid" } | { status: "expired" } | { status: "weak"; message: string };

export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!token) return { status: "invalid" };
  const problem = passwordProblem(newPassword);
  if (problem) return { status: "weak", message: problem };
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { email: true } } },
  });
  if (!row || row.usedAt) return { status: "invalid" };
  if (row.expiresAt < new Date()) return { status: "expired" };

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const now = new Date();
  await prisma.$transaction([
    // Spend this token only if no other request spent it first.
    prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } }),
    prisma.user.update({ where: { id: row.userId }, data: { password: hashed } }),
    // Any other outstanding links for this account stop working.
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  return { status: "reset", email: row.user.email };
}
