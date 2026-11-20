/**
 * Keeps Better Auth's credential Account in step with User.password while
 * both sign-in systems exist (design 02, section 10a). Every place that
 * sets a password calls this with the same bcrypt hash; Better Auth's
 * `verify` accepts bcrypt.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

export async function syncCredentialAccount(db: Db, userId: string, hash: string) {
  await db.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: userId } },
    create: { providerId: "credential", accountId: userId, userId, password: hash },
    update: { password: hash },
  });
}
