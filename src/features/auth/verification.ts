/**
 * Email verification.
 *
 * Accounts are created by staff (there is no self sign-up), so the address
 * on an account may be mistyped or not the user's. A verified address is
 * required before any notification email is sent to it.
 *
 * Flow: `sendVerificationEmail` stores a SHA-256 hash of a random token and
 * emails the raw token in a link to /verify-email; `consumeVerificationToken`
 * checks it, marks the user verified and deletes their outstanding tokens.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";
import type { SendEmailResult } from "@/lib/email/send";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(userId: string): Promise<SendEmailResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!user) return { ok: false, error: "Account not found" };
  if (user.emailVerified) return { ok: false, error: "Email is already verified" };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // One live link at a time.
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  // Through the send queue (AUTH priority), tried at once. The raw token is
  // sealed in the row and removed once the email is sent or given up.
  const key = `auth:verify:${user.id}:${hashToken(token).slice(0, 16)}`;
  await enqueueEmail(prisma, {
    key,
    template: "auth:verify",
    to: user.email,
    userId: user.id,
    category: "ACCOUNT",
    priority: "AUTH",
    data: { name: user.name, tokenSealed: sealForQueue(token) },
  });
  const [r] = await sendQueuedNow([key]);
  if (r.outcome === "sent" || r.outcome === "retrying" || r.outcome === "skipped") return { ok: true, id: key };
  return { ok: false, error: r.error ?? "Email not sent" };
}

export type VerifyResult =
  | { status: "verified"; email: string }
  | { status: "invalid" }
  | { status: "expired" };

export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (!token) return { status: "invalid" };
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, expiresAt: true, user: { select: { email: true } } },
  });
  if (!row) return { status: "invalid" };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
    return { status: "expired" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { status: "verified", email: row.user.email };
}
