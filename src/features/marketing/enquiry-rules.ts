/**
 * Landing-page enquiries (#216): the pure rules, so the check script can
 * cover them without a database. The service is ./enquiries.ts.
 */

import { z } from "zod";

export const ENQUIRY_KINDS = ["ACCESS", "TEAM", "OTHER"] as const;
export type EnquiryKind = (typeof ENQUIRY_KINDS)[number];

export const ENQUIRY_LIMITS = {
  /** Enquiries from one address (IP) an hour. */
  perIpHour: 5,
  /** Enquiries from one email a day. */
  perEmailDay: 3,
  /** A form sent sooner than this after it was shown is a bot. */
  minFillMs: 3_000,
  /** A form older than this is stale (reload the page). */
  maxFillMs: 24 * 60 * 60 * 1000,
  /** Kept this long, then deleted by housekeeping. */
  keepDays: 365,
} as const;

const trimmed = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const enquirySchema = z.object({
  kind: z.enum(ENQUIRY_KINDS).default("ACCESS"),
  name: trimmed(120).min(2, "Please give your name."),
  email: trimmed(254).toLowerCase().email("Please give a valid email address."),
  phone: optional(40).refine((v) => !v || /^[+()\d\s-]{7,40}$/.test(v), "Please give a valid phone number."),
  organisation: optional(160),
  students: z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined),
  message: trimmed(4000).min(10, "Please tell us a little more (at least 10 characters)."),
  source: optional(120),
  /** Date.now() when the form was shown. */
  startedAt: z.coerce.number().int().optional(),
  /** Honeypot: hidden from people. Anything here means a bot. */
  website: z.string().optional(),
});
export type EnquiryInput = z.input<typeof enquirySchema>;
export type EnquiryParsed = z.output<typeof enquirySchema>;

/** "bot" answers as if it worked, so bots learn nothing; "stale" asks for a reload. */
export function screenEnquiry(input: Pick<EnquiryParsed, "startedAt" | "website">, now: number): "ok" | "bot" | "stale" {
  if (input.website && input.website.trim()) return "bot";
  if (input.startedAt == null) return "ok";
  const age = now - input.startedAt;
  if (age < ENQUIRY_LIMITS.minFillMs) return "bot";
  if (age > ENQUIRY_LIMITS.maxFillMs) return "stale";
  return "ok";
}

/** A source we keep: a same-site path, or a short campaign name. Anything else is dropped. */
export function cleanSource(source: string | undefined): string | null {
  if (!source) return null;
  if (source.startsWith("/") && !source.startsWith("//")) return source.split(/[?#]/)[0].slice(0, 120);
  return /^[\w.-]{1,60}$/.test(source) ? source : null;
}

/** Links and many URLs are the mark of spam in a message. */
export function looksLikeSpam(message: string): boolean {
  const links = message.match(/https?:\/\/|www\./gi)?.length ?? 0;
  return links > 3;
}
