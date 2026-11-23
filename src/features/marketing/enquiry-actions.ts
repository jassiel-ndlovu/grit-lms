"use server";

/**
 * Landing-page enquiries (#216). Contract: docs/revamp/contracts/viewer.md,
 * "Landing page".
 *
 *   submitPlatformEnquiry   public; B's "Request access" and team forms
 *   adminListEnquiries      Nexa admin
 *   adminUpdateEnquiry      Nexa admin
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionClient, adminActionClient } from "@/lib/safe-action";

import { countNewEnquiries, listEnquiries, submitEnquiry, updateEnquiry } from "./enquiries";
import { enquirySchema } from "./enquiry-rules";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
}

export const submitPlatformEnquiry = actionClient
  .schema(enquirySchema)
  .action(async ({ parsedInput }) => submitEnquiry(parsedInput, await clientIp()));

const status = z.enum(["NEW", "CONTACTED", "CLOSED", "SPAM"]);

export const adminListEnquiries = adminActionClient
  .schema(z.object({ status: status.optional(), cursor: z.string().max(64).optional(), limit: z.number().int().min(1).max(100).optional() }))
  .action(async ({ parsedInput }) => ({ ...(await listEnquiries(parsedInput)), newCount: await countNewEnquiries() }));

export const adminUpdateEnquiry = adminActionClient
  .schema(z.object({ id: z.string().min(1).max(64), status, note: z.string().trim().max(2000).nullable().optional() }))
  .action(async ({ parsedInput }) => {
    const row = await updateEnquiry(parsedInput);
    revalidatePath("/dashboard/admin", "layout");
    return row;
  });
