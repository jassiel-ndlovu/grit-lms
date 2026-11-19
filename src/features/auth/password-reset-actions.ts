"use server";

/** Public actions for /forgot-password (no session needed). */

import { z } from "zod";

import { actionClient } from "@/lib/safe-action";

import { requestPasswordReset, resetPassword } from "./password-reset";

/** Always answers `{ ok: true }`, so it can't reveal which emails have accounts. */
export const requestPasswordResetAction = actionClient
  .schema(z.object({ email: z.string().trim().max(254) }))
  .action(async ({ parsedInput }) => {
    try {
      await requestPasswordReset(parsedInput.email);
    } catch (e) {
      console.error("[auth] password reset request failed:", (e as Error).message);
    }
    return { ok: true as const };
  });

export const resetPasswordAction = actionClient
  .schema(z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) }))
  .action(async ({ parsedInput }) => resetPassword(parsedInput.token, parsedInput.password));
