"use server";

/**
 * AI credits for B's screens (#216 phase 1). Contract: billing.md,
 * "AI credits". Logic in ./credits.ts.
 *
 *   getMyAiCredits        any staff member: what they may still use
 *   getAiCreditReport     ai.credits.allocate: pools, use by person and feature, allowances
 *   setAiAllowance        ai.credits.allocate: monthly limits by person, team, branch or default
 *   setPersonalAiCredits  ai.credits.allocate for the whole workspace: may tutors add their own?
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";
import { can, staffScope, type Viewer } from "@/lib/viewer-core";

import { balancesFor, creditReportFor, setAllowanceFor, setPersonalCreditsFor } from "./credits";

function manager(viewer: Viewer) {
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "ai.credits.allocate")) throw new ViewerError("FORBIDDEN");
  return { userId: viewer.user.id, workspaceId: viewer.workspace.id };
}

export const getMyAiCredits = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => {
    if (!viewer.workspace || viewer.persona !== "staff") throw new ViewerError("FORBIDDEN");
    const b = await balancesFor(prisma, viewer.workspace.id, viewer.user.id);
    return {
      organisationLeft: b.balances.included + b.balances.bought,
      allowance: b.allowance, usedThisMonth: b.usedThisMonth, allowanceLeft: b.balances.allowanceLeft,
      personal: b.balances.personal, personalAllowed: b.balances.personalAllowed,
      comped: b.comped, warning: b.warning,
    };
  });

export const getAiCreditReport = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => creditReportFor(manager(viewer).workspaceId));

export const setAiAllowance = writableViewerActionClient
  .schema(z.object({ targetType: z.enum(["WORKSPACE_DEFAULT", "BRANCH", "TEAM", "MEMBERSHIP"]), targetId: z.string().max(64).optional(), monthlyCredits: z.number().int().nullable() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const r = await setAllowanceFor(manager(viewer), parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const setPersonalAiCredits = writableViewerActionClient
  .schema(z.object({ allowed: z.boolean() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const actor = manager(viewer);
    if (staffScope(viewer) !== "WORKSPACE") throw new ViewerError("FORBIDDEN");
    const r = await setPersonalCreditsFor(actor, parsedInput.allowed);
    revalidatePath("/dashboard", "layout");
    return r;
  });
