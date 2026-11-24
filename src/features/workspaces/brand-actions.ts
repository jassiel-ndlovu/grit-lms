"use server";

/**
 * Branding, white-label and bulk onboarding (#216 phase 3). Contract:
 * viewer.md, "Branding and white-label" and "Bulk onboarding".
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionClient, viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import * as brand from "./branding";
import * as rollout from "./rollout";

const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
function done<T>(r: T): T {
  revalidatePath("/", "layout");
  return r;
}

export const getBrandingAction = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => brand.getBranding(v(ctx)));

export const setBrandingAction = writableViewerActionClient
  .schema(z.object({ logoUrl: z.string().url().max(1000).nullable().optional(), accentColor: z.string().max(7).nullable().optional(), senderName: z.string().max(80).nullable().optional(), welcomeText: z.string().max(300).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await brand.setBranding(v(ctx), parsedInput)));

export const setWhiteLabelAction = writableViewerActionClient
  .schema(z.object({ hideNexaBranding: z.boolean(), supportEmail: z.string().max(254).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await brand.setWhiteLabel(v(ctx), parsedInput)));

/** Public: the branded sign-in page /w/<slug>. Null when the workspace has no branding. */
export const getBrandForSlug = actionClient
  .schema(z.object({ slug: z.string().min(1).max(80) }))
  .action(async ({ parsedInput }) => brand.brandForSlug(parsedInput.slug));

export const getOnboardingAction = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => rollout.onboardingStatus(v(ctx)));

export const setBranchRolloutAction = writableViewerActionClient
  .schema(z.object({ branchId: z.string().min(1).max(64), rollout: z.enum(["PLANNED", "PILOT", "LIVE"]) }))
  .action(async ({ parsedInput, ctx }) => done(await rollout.setBranchRollout(v(ctx), parsedInput)));

export const adminOnboardingOverviewAction = viewerActionClient
  .schema(z.object({ limit: z.number().int().min(1).max(200).optional() }))
  .action(async ({ parsedInput, ctx }) => rollout.adminOnboardingOverview(v(ctx), parsedInput));
