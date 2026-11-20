/**
 * Better Auth (design 02, section 2). STAGE 1: configured and mounted at
 * /api/ba behind BETTER_AUTH_ENABLED=1, next to NextAuth, which still signs
 * everyone in. The cutover (stage 2) moves getViewer, middleware and the
 * sign-in screens here and removes NextAuth.
 *
 * - Database sessions in `Session`, so they can be revoked.
 * - Passwords in `Account` (providerId "credential"). Hashes carried over
 *   from User.password are bcrypt ($2…); new ones use Better Auth's scrypt.
 *   `verify` accepts both.
 * - Sign-up is off until the cutover: our User still needs `password`.
 * - Plugins: username (students without email), two-factor (required for
 *   owners and Nexa admins at the cutover).
 * - Rate limits stored in the database (serverless has no shared memory).
 *
 * Server only.
 */

import "server-only";

import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";

import { prisma } from "@/lib/db";

/** True for a bcrypt hash carried over from NextAuth. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export const betterAuthInstance = betterAuth({
  appName: "Nexa",
  baseURL: appUrl,
  basePath: "/api/ba",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustedOrigins: [appUrl, "https://www.nexa-lms.co.za", "https://nexa-lms.co.za"],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  telemetry: { enabled: false },
  advanced: {
    cookiePrefix: "nexa",
    // Prisma fills ids (@default(cuid())), like every other table.
    database: { generateId: false },
  },
  user: {
    // Our User.emailVerified is a DateTime until the cutover.
    fields: { emailVerified: "emailConfirmed" },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: {
      hash: (password) => hashPassword(password),
      verify: async ({ hash, password }) => (isBcryptHash(hash) ? bcrypt.compare(password, hash) : verifyPassword({ hash, password })),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/username": { window: 60, max: 5 },
    },
  },
  plugins: [username(), twoFactor({ issuer: "Nexa" }), nextCookies()],
});

export function betterAuthEnabled(): boolean {
  return process.env.BETTER_AUTH_ENABLED === "1";
}
