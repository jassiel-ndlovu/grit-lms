import "server-only";

/**
 * Server reads for the account screens (#178, #182, #185). Reads only; the
 * writes are A's actions (privacy-actions, email-change-actions).
 */

import { prisma } from "@/lib/db";

/** A credential account with a password, or a legacy User.password. Google-only accounts have neither. */
export async function accountHasPassword(userId: string): Promise<boolean> {
  const [acc, u] = await Promise.all([
    prisma.account.findFirst({ where: { userId, providerId: "credential", password: { not: null } }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { password: true } }),
  ]);
  return Boolean(acc || u?.password);
}

export interface AccountFacts {
  /** Null when the address is a placeholder (a student made without one). */
  email: string | null;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
}

export async function getAccountFacts(userId: string): Promise<AccountFacts | null> {
  const [u, hasPassword] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailIsPlaceholder: true, twoFactorEnabled: true } }),
    accountHasPassword(userId),
  ]);
  if (!u) return null;
  return { email: u.emailIsPlaceholder ? null : u.email, hasPassword, twoFactorEnabled: Boolean(u.twoFactorEnabled) };
}
