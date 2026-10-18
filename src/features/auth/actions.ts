/**
 * Auth Server Actions that don't need a session.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionClient } from "@/lib/safe-action";

import { consumeVerificationToken } from "./verification";

/**
 * Confirm an email address from the link in a verification email. Public:
 * the token itself is the proof, and the user may open the link on a
 * device where they aren't signed in.
 */
export const confirmEmailVerification = actionClient
  .schema(z.object({ token: z.string().min(1).max(200) }))
  .action(async ({ parsedInput }) => {
    const result = await consumeVerificationToken(parsedInput.token);
    if (result.status === "verified") revalidatePath("/dashboard/settings");
    return result;
  });
