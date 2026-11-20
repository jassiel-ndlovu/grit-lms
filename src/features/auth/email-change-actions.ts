"use server";

/** Changing an account's email (design 02, section 8; ./email-change.ts). */

import { z } from "zod";

import { actionClient, viewerActionClient } from "@/lib/safe-action";
import { requireViewer } from "@/lib/viewer";

import { confirmEmailChangeFor, requestEmailChangeFor, revertEmailChangeFor } from "./email-change";

/** Settings: the user's password and the new address. Sends a confirm link to the new address. */
export const requestEmailChange = viewerActionClient
  .schema(z.object({ password: z.string().min(1).max(200), newEmail: z.string().trim().email().max(200) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
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
