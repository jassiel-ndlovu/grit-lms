"use server";

/**
 * Nexa admin workspace actions (#206). Each needs the Nexa admin persona
 * and `admin.override`, takes a note, and writes an AuditLog row.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { grantCreditsFor } from "@/features/ai-credits/credits";
import { switchTeachingOnFor } from "@/features/workspaces/teaching";
import { adminActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";
import { can, type Viewer } from "@/lib/viewer-core";

/** Switches teaching back on for an organisation that switched it off. Only a Nexa admin can. */
export const adminSwitchTeachingOn = adminActionClient
  .schema(z.object({ workspaceId: z.string().min(1).max(64), note: z.string().trim().min(3).max(500) }))
  .action(async ({ parsedInput, ctx }) => {
    const viewer = (ctx as { viewer: Viewer }).viewer;
    if (!can(viewer, "admin.override")) throw new ViewerError("FORBIDDEN");
    const r = await switchTeachingOnFor({ userId: viewer.user.id, impersonatorUserId: viewer.impersonatedBy?.userId ?? null }, parsedInput);
    revalidatePath("/dashboard/admin", "layout");
    return r;
  });

/** Gives (or, negative, takes back) AI credits: bought credits for the organisation, or personal ones for one person. With a note; audited. */
export const adminGrantAiCredits = adminActionClient
  .schema(z.object({ workspaceId: z.string().min(1).max(64), credits: z.number().int(), pool: z.enum(["BOUGHT", "PERSONAL"]), userId: z.string().min(1).max(64).optional(), note: z.string().trim().min(3).max(500) }))
  .action(async ({ parsedInput, ctx }) => {
    const viewer = (ctx as { viewer: Viewer }).viewer;
    if (!can(viewer, "admin.override")) throw new ViewerError("FORBIDDEN");
    return grantCreditsFor({ userId: viewer.user.id, impersonatorUserId: viewer.impersonatedBy?.userId ?? null }, parsedInput);
  });
