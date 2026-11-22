"use server";

/** Changing an account's email (design 02, section 8; ./email-change.ts). */

import { headers } from "next/headers";
import { z } from "zod";

import { betterAuthInstance } from "@/lib/better-auth";
import { prisma } from "@/lib/db";

import { actionClient, viewerActionClient } from "@/lib/safe-action";
import { requireViewer } from "@/lib/viewer";

import { confirmEmailChangeFor, requestEmailChangeFor, revertEmailChangeFor } from "./email-change";
import { UserError } from "@/lib/user-error";

/** Settings: the user's password and the new address. Sends a confirm link to the new address. */
export const requestEmailChange = viewerActionClient
  .schema(z.object({ password: z.string().min(1).max(200), newEmail: z.string().trim().email().max(200) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    // With two-factor on, the password alone isn't enough: the session must
    // be fresh, i.e. signed in (with the authenticator code) in the last 15
    // minutes (design 02, section 8).
    const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.user.id }, select: { twoFactorEnabled: true } });
    if (u.twoFactorEnabled) {
      const s = await betterAuthInstance.api.getSession({ headers: await headers() });
      if (!s || Date.now() - new Date(s.session.createdAt).getTime() > 15 * 60 * 1000) {
        throw new UserError("For your security, sign out and sign in again with your authenticator code, then change your email within 15 minutes.");
      }
    }
    return requestEmailChangeFor(viewer.user.id, parsedInput);
  });

/** /account/confirm-email?token=… (a button, not on load). Signs the user out everywhere when it works. */
export const confirmEmailChange = actionClient
  .schema(z.object({ token: z.string().min(10).max(200) }))
  .action(async ({ parsedInput }) => confirmEmailChangeFor(parsedInput.token));

/** /account/revert-email?token=… ("This wasn't me", a button, not on load). */
export const revertEmailChange = actionClient
  .schema(z.object({ token: z.string().min(10).max(200) }))
  .action(async ({ parsedInput }) => revertEmailChangeFor(parsedInput.token));
