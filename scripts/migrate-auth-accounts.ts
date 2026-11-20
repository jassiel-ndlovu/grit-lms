/**
 * Copies each user's password hash into a Better Auth credential Account,
 * and their verified email into User.emailConfirmed (design 02, section 2).
 *
 *   npx tsx scripts/migrate-auth-accounts.ts            # dry run: counts only
 *   npx tsx scripts/migrate-auth-accounts.ts --apply    # writes
 *
 * Idempotent: a user who already has a credential Account gets its hash
 * refreshed only when User.password changed since (a NextAuth-era reset).
 * Run on preview to test; on production at the cutover, so the hashes are
 * current. Prints counts, never hashes or emails.
 */

import { PrismaClient } from "../src/generated/prisma";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:]+)/)?.[1] ?? "?";
  console.log(`Database host: ${host.split(".")[0]}  (${apply ? "APPLY" : "dry run"})`);

  const users = await prisma.user.findMany({
    select: { id: true, password: true, emailVerified: true, emailConfirmed: true, authAccounts: { where: { providerId: "credential" }, select: { id: true, password: true } } },
  });
  let create = 0, refresh = 0, same = 0, noPassword = 0, confirm = 0;
  for (const u of users) {
    if (u.emailVerified && !u.emailConfirmed) {
      confirm++;
      if (apply) await prisma.user.update({ where: { id: u.id }, data: { emailConfirmed: true } });
    }
    if (!u.password) {
      noPassword++;
      continue;
    }
    const acc = u.authAccounts[0];
    if (!acc) {
      create++;
      if (apply) await prisma.account.create({ data: { accountId: u.id, providerId: "credential", userId: u.id, password: u.password } });
    } else if (acc.password !== u.password && acc.password?.startsWith("$2")) {
      // Still a carried-over bcrypt hash and the user changed their password through NextAuth since.
      refresh++;
      if (apply) await prisma.account.update({ where: { id: acc.id }, data: { password: u.password } });
    } else {
      same++;
    }
  }
  console.log(`users ${users.length}: create ${create}, refresh ${refresh}, unchanged ${same}, no password ${noPassword}; emails to mark confirmed ${confirm}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
