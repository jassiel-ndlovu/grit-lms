/**
 * Landing-page enquiries to Nexa (#216). B's form calls
 * `submitPlatformEnquiry` (./enquiry-actions.ts); Nexa admins list and
 * update them. Each new enquiry emails the Nexa inbox (ENQUIRY_TO, else
 * APP_CONTACT.email). Nothing is sent to the enquirer, so the form can't be
 * used to send mail to strangers.
 *
 * Privacy: the IP is kept only as a keyed hash, for rate limits. Rows are
 * deleted after ENQUIRY_LIMITS.keepDays (housekeeping).
 */

import "server-only";

import { createHmac } from "node:crypto";

import { APP_CONTACT } from "@/lib/branding";
import { prisma } from "@/lib/db";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import { UserError } from "@/lib/user-error";

import type { EnquiryStatus } from "@/generated/prisma";

import { cleanSource, ENQUIRY_LIMITS, type EnquiryParsed, looksLikeSpam, screenEnquiry } from "./enquiry-rules";

export function hashIp(ip: string): string {
  const key = process.env.NEXTAUTH_SECRET ?? "nexa-local";
  return createHmac("sha256", `nexa-enquiry-ip:${key}`).update(ip.trim().toLowerCase()).digest("hex");
}

function inbox(): string {
  return process.env.ENQUIRY_TO || APP_CONTACT.email;
}

export type SubmitResult = { ok: true };

/**
 * Saves an enquiry and emails the Nexa inbox. A bot or spam gets the same
 * answer as a person, so it learns nothing; its row is saved as SPAM and
 * no email goes out.
 */
export async function submitEnquiry(input: EnquiryParsed, ip: string, now = new Date()): Promise<SubmitResult> {
  const screen = screenEnquiry(input, now.getTime());
  if (screen === "stale") throw new UserError("This form has been open a long time. Please reload the page and try again.");
  const ipHash = hashIp(ip || "unknown");

  const hourAgo = new Date(now.getTime() - 3_600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [byIp, byEmail] = await Promise.all([
    prisma.platformEnquiry.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
    prisma.platformEnquiry.count({ where: { email: input.email, createdAt: { gte: dayAgo } } }),
  ]);
  if (byIp >= ENQUIRY_LIMITS.perIpHour || byEmail >= ENQUIRY_LIMITS.perEmailDay) {
    throw new UserError("We've already received your enquiry. We'll be in touch soon, or email us directly.");
  }

  const spam = screen === "bot" || looksLikeSpam(input.message);
  const row = await prisma.platformEnquiry.create({
    data: {
      kind: input.kind,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      organisation: input.organisation ?? null,
      students: input.students ?? null,
      message: input.message,
      source: cleanSource(input.source),
      status: spam ? "SPAM" : "NEW",
      ipHash,
    },
    select: { id: true },
  });
  if (spam) return { ok: true };

  const key = `enquiry:new:${row.id}`;
  await enqueueEmail(prisma, {
    key,
    template: "enquiry:new",
    to: inbox(),
    category: "enquiry",
    data: {
      id: row.id,
      kind: input.kind,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      organisation: input.organisation ?? null,
      students: input.students ?? null,
      message: input.message,
      source: cleanSource(input.source),
    },
  });
  // Best effort now; the queue retries if this fails.
  await sendQueuedNow([key]).catch(() => undefined);
  return { ok: true };
}

export type EnquiryRow = {
  id: string; kind: string; name: string; email: string; phone: string | null; organisation: string | null;
  students: number | null; message: string; source: string | null; status: EnquiryStatus; note: string | null;
  createdAt: Date; handledAt: Date | null;
};

const rowSelect = {
  id: true, kind: true, name: true, email: true, phone: true, organisation: true, students: true,
  message: true, source: true, status: true, note: true, createdAt: true, handledAt: true,
} as const;

/** Newest first. Without `status`, everything but SPAM. */
export async function listEnquiries(input: { status?: EnquiryStatus; cursor?: string; limit?: number }): Promise<{ items: EnquiryRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const items = await prisma.platformEnquiry.findMany({
    where: input.status ? { status: input.status } : { status: { not: "SPAM" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: rowSelect,
  });
  const more = items.length > limit;
  return { items: items.slice(0, limit), nextCursor: more ? items[limit - 1].id : null };
}

export async function countNewEnquiries(): Promise<number> {
  return prisma.platformEnquiry.count({ where: { status: "NEW" } });
}

export async function updateEnquiry(input: { id: string; status: EnquiryStatus; note?: string | null }): Promise<EnquiryRow> {
  const found = await prisma.platformEnquiry.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!found) throw new UserError("That enquiry no longer exists.");
  return prisma.platformEnquiry.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.note !== undefined ? { note: input.note || null } : {}),
      handledAt: input.status === "NEW" ? null : new Date(),
    },
    select: rowSelect,
  });
}

/** Housekeeping: deletes enquiries older than the keep period. */
export async function pruneOldEnquiries(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - ENQUIRY_LIMITS.keepDays * 86_400_000);
  const { count } = await prisma.platformEnquiry.deleteMany({ where: { createdAt: { lt: before } } });
  return count;
}
