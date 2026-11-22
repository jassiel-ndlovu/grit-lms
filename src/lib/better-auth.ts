/**
 * Better Auth (design 02, section 2). Mounted at /api/ba.
 *
 * Which system signs people in is chosen by AUTH_PROVIDER: unset keeps
 * NextAuth (stage 1), "better-auth" is the cutover (stage 2). `auth()` in
 * ./auth.ts reads whichever is on, so pages and actions don't change.
 *
 * - Database sessions in `Session`, so they can be revoked.
 * - Passwords in `Account` (providerId "credential"). Our own actions still
 *   hash with bcrypt and keep User.password in step
 *   (features/auth/credential.ts); `verify` accepts bcrypt and scrypt.
 * - Sign-up (email and password, or Google) is on only after the cutover.
 *   A self sign-up has no role yet (`roleUnconfirmed`, legacy role STUDENT
 *   meanwhile, which grants nothing without a workspace) and chooses tutor,
 *   student or parent on the welcome page (features/users/choose-role.ts).
 *   Email sign-ups verify their address first.
 * - Google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. A Google
 *   sign-in with the email of an existing account links to it.
 * - Plugins: username (students without email), two-factor.
 * - Rate limits stored in the database (serverless has no shared memory).
 *
 * Server only.
 */

import "server-only";

import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";

import { looksLikeCode, normaliseCode } from "@/features/auth/codes";
import { prisma } from "@/lib/db";
import { enqueueEmail, sealForQueue, sendQueuedNow } from "@/lib/email/queue";

/** True for a bcrypt hash carried over from NextAuth. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/** "better-auth" once the cutover is switched on. */
/** Better Auth is the only sign-in since the 2026-11-20 cutover. Kept for callers. */
export function authProvider(): "better-auth" {
  return "better-auth";
}

export function betterAuthEnabled(): boolean {
  return true;
}

const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
/** Vercel Preview: every deployment has its own address, so take it from the request, limited to this team's preview hosts. */
const PREVIEW_HOSTS = ["*-jassiel-ndlovus-projects.vercel.app"];

/**
 * Outside production, test addresses count as verified at sign-up and get
 * no verification email (Resend can't deliver to them anyway): the
 * reserved @example.test domain, plus any domain in
 * TEST_VERIFIED_EMAIL_DOMAINS (comma separated). Never in production.
 */
export function verificationWaived(email: string, env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const extra = (env.TEST_VERIFIED_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return domain === "example.test" || extra.includes(domain);
}
const isPreview = process.env.VERCEL_ENV === "preview";
const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
  : null;

/** Better Auth's emailVerified is our emailConfirmed; keep the older emailVerified date in step. */
async function stampEmailVerified(user: { id: string; emailVerified?: boolean | null }) {
  if (user.emailVerified) await prisma.user.updateMany({ where: { id: user.id, emailVerified: null }, data: { emailVerified: new Date() } });
}

export const betterAuthInstance = betterAuth({
  appName: "Nexa",
  baseURL: isPreview ? { allowedHosts: PREVIEW_HOSTS, fallback: appUrl } : appUrl,
  basePath: "/api/ba",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustedOrigins: [appUrl, "https://www.nexa-lms.co.za", "https://nexa-lms.co.za", ...(isPreview ? PREVIEW_HOSTS.map((h) => `https://${h}`) : [])],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  telemetry: { enabled: false },
  advanced: {
    cookiePrefix: "nexa",
    // Prisma fills ids (@default(cuid())), like every other table.
    database: { generateId: false },
  },
  user: {
    // Our User.emailVerified is a DateTime; Better Auth's boolean lives in emailConfirmed.
    fields: { emailVerified: "emailConfirmed" },
    additionalFields: {
      role: { type: "string", required: false, input: false, defaultValue: "STUDENT" },
      roleUnconfirmed: { type: "boolean", required: false, input: false, defaultValue: false },
      platformRole: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Activity log, as NextAuth's sign-in event did.
        after: async (session) => {
          await prisma.activityLog.create({ data: { userId: session.userId, action: "LOGIN" } }).catch(() => undefined);
        },
        // A sign-in code from a tutor stops working after 14 days unless the user chose a password.
        before: async (session) => {
          const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { mustChangePassword: true, initialCodeExpiresAt: true, deletionRequestedAt: true, deletedAt: true } });
          if (u?.deletedAt || u?.deletionRequestedAt) {
            throw new APIError("FORBIDDEN", { message: "This account is being deleted. Use the link in the email we sent to cancel." });
          }
          if (u?.mustChangePassword && u.initialCodeExpiresAt && u.initialCodeExpiresAt < new Date()) {
            throw new APIError("FORBIDDEN", { message: "Your sign-in code has expired. Ask your tutor for a new one." });
          }
        },
      },
    },
    user: {
      create: {
        // A self sign-up chooses tutor, student or parent on the welcome page.
        before: async (user) => ({
          data: { ...user, role: "STUDENT", roleUnconfirmed: true, ...(verificationWaived(user.email) ? { emailVerified: true } : {}) },
        }),
        after: async (user) => stampEmailVerified(user),
      },
      update: { after: async (user) => stampEmailVerified(user) },
    },
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: authProvider() !== "better-auth",
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: {
      hash: (password) => hashPassword(password),
      verify: async ({ hash, password }) => {
        const check = (pw: string) => (isBcryptHash(hash) ? bcrypt.compare(pw, hash) : verifyPassword({ hash, password: pw }));
        if (await check(password)) return true;
        // A sign-in code typed in lower case or without its dashes (features/auth/codes.ts).
        return looksLikeCode(password) ? check(normaliseCode(password)) : false;
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    // Through our queue (budget, allowlist off production, retries).
    sendVerificationEmail: async ({ user, url }) => {
      if (verificationWaived(user.email)) return;
      const key = `auth:verify:ba:${user.id}:${Date.now()}`;
      await enqueueEmail(prisma, {
        key, template: "auth:verify", to: user.email, userId: user.id, workspaceId: null, category: "ACCOUNT", priority: "AUTH",
        data: { name: user.name, urlSealed: sealForQueue(url) },
      });
      await sendQueuedNow([key]);
    },
  },
  socialProviders: google ? { google: { ...google, prompt: "select_account", disableSignUp: authProvider() !== "better-auth" } } : {},
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
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  plugins: [username(), twoFactor({ issuer: "Nexa", allowPasswordless: true /* only for accounts without a password, e.g. Google sign-ups (#178) */ }), nextCookies()],
});
