"use server";

/**
 * Enquiry pipeline, tutor outcomes and staff reviews (#216 phase 3).
 * Contract: viewer.md, "Enquiry pipeline" and "Tutor outcomes and reviews".
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionClient, viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import * as outcomes from "@/features/staff/outcomes";

import * as e from "./enquiries";

const id = z.string().min(1).max(64);
const stage = z.enum(["NEW", "CONTACTED", "TRIAL", "ENROLLED", "LOST"]);
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
function done<T>(r: T): T {
  revalidatePath("/dashboard", "layout");
  return r;
}

/* Public */

export const getEnquiryForm = actionClient
  .schema(z.object({ slug: z.string().min(1).max(80) }))
  .action(async ({ parsedInput }) => e.enquiryFormFor(parsedInput.slug));

export const submitWorkspaceEnquiryAction = actionClient
  .schema(e.publicEnquirySchema)
  .action(async ({ parsedInput }) => {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
    return e.submitWorkspaceEnquiry(parsedInput, ip);
  });

/* Enquiries (enquiries.manage) */

export const listEnquiriesAction = viewerActionClient
  .schema(z.object({ stage: stage.optional(), assigned: z.enum(["me", "none"]).optional(), branchId: id.optional(), q: z.string().max(100).optional(), dueOnly: z.boolean().optional(), limit: z.number().int().min(1).max(300).optional() }))
  .action(async ({ parsedInput, ctx }) => e.listEnquiries(v(ctx), parsedInput));

export const getEnquiryAction = viewerActionClient.schema(z.object({ id })).action(async ({ parsedInput, ctx }) => e.getEnquiry(v(ctx), parsedInput));

export const createEnquiryAction = writableViewerActionClient
  .schema(e.enquiryInput)
  .action(async ({ parsedInput, ctx }) => done(await e.createEnquiry(v(ctx), parsedInput)));

export const updateEnquiryAction = writableViewerActionClient
  .schema(e.enquiryInput.partial().extend({ id }))
  .action(async ({ parsedInput, ctx }) => done(await e.updateEnquiry(v(ctx), parsedInput)));

export const moveEnquiryAction = writableViewerActionClient
  .schema(z.object({ id, stage, lostReason: z.string().max(300).nullable().optional(), learnerId: id.nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await e.moveEnquiry(v(ctx), parsedInput)));

export const addEnquiryNoteAction = writableViewerActionClient
  .schema(z.object({ id, body: z.string().max(4000) }))
  .action(async ({ parsedInput, ctx }) => done(await e.addEnquiryNote(v(ctx), parsedInput)));

export const emailEnquirerAction = writableViewerActionClient
  .schema(z.object({ id, subject: z.string().max(150), body: z.string().max(6000) }))
  .action(async ({ parsedInput, ctx }) => done(await e.emailEnquirer(v(ctx), parsedInput)));

export const enquiryFunnelAction = viewerActionClient
  .schema(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
  .action(async ({ parsedInput, ctx }) => e.enquiryFunnel(v(ctx), parsedInput));

export const setEnquiryFormAction = writableViewerActionClient
  .schema(z.object({ on: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => done(await e.setEnquiryForm(v(ctx), parsedInput)));

/* Tutor outcomes and reviews */

export const listTutorOutcomesAction = viewerActionClient
  .schema(z.object({ from: z.coerce.date(), to: z.coerce.date(), membershipIds: z.array(id).max(200).optional() }))
  .action(async ({ parsedInput, ctx }) => outcomes.listTutorOutcomes(v(ctx), parsedInput));

export const createReviewAction = writableViewerActionClient
  .schema(z.object({ membershipId: id, from: z.coerce.date(), to: z.coerce.date() }))
  .action(async ({ parsedInput, ctx }) => done(await outcomes.createReview(v(ctx), parsedInput)));

export const updateReviewAction = writableViewerActionClient
  .schema(z.object({ id, strengths: z.string().max(4000).nullable().optional(), improvements: z.string().max(4000).nullable().optional(), goals: z.string().max(4000).nullable().optional(), rating: z.number().int().nullable().optional(), refreshOutcomes: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await outcomes.updateReview(v(ctx), parsedInput)));

export const shareReviewAction = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput, ctx }) => done(await outcomes.shareReview(v(ctx), parsedInput)));

export const acknowledgeReviewAction = writableViewerActionClient
  .schema(z.object({ id, response: z.string().max(2000).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await outcomes.acknowledgeReview(v(ctx), parsedInput)));

export const listReviewsAction = viewerActionClient
  .schema(z.object({ membershipId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => outcomes.listReviews(v(ctx), parsedInput));
