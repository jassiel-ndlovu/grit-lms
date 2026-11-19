"use server";

/**
 * The course Services view asks for a price preview from the client before
 * each switch (billing.md, rules for B, 2). A's `previewServiceChange` is a
 * server query; this exposes it as an action. It checks `courses.services`
 * itself, and throws BILLING_DISABLED when billing is off.
 */

import { z } from "zod";

import { viewerActionClient } from "@/lib/safe-action";
import { previewServiceChange } from "@/features/billing/queries";

const keys = z.array(z.string().min(1).max(64)).max(32);

export const previewCourseServiceChange = viewerActionClient
  .schema(z.object({ courseId: z.string().min(1), enable: keys.default([]), disable: keys.default([]) }))
  .action(async ({ parsedInput }) => previewServiceChange(parsedInput));
