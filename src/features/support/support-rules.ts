/**
 * Help and contact centre: the pure rules (owner 24 Nov). Contract:
 * docs/revamp/contracts/support.md. Client-safe: the form and inboxes use
 * the labels and schemas here.
 */

import { z } from "zod";

export const SUPPORT_KINDS = ["QUESTION", "PROBLEM", "FEEDBACK"] as const;
export const SUPPORT_TOPICS = ["ACCOUNT", "CLASSES", "TESTS", "PAYMENTS", "SUBSCRIPTION", "APP", "OTHER"] as const;
export const SUPPORT_ROUTES = ["NEXA", "WORKSPACE"] as const;
export const SUPPORT_STATUSES = ["OPEN", "ANSWERED", "CLOSED"] as const;

export type SupportKind = (typeof SUPPORT_KINDS)[number];
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
export type SupportRoute = (typeof SUPPORT_ROUTES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export type SupportPersona = "learner" | "guardian" | "staff" | "admin" | "public";

export const KIND_LABEL: Record<SupportKind, string> = {
  QUESTION: "Ask a question",
  PROBLEM: "Report a problem",
  FEEDBACK: "Share feedback",
};

/** One line under each kind, so people pick the right one. */
export const KIND_HINT: Record<SupportKind, string> = {
  QUESTION: "You want to know how to do something, or why something happened.",
  PROBLEM: "Something isn't working, shows the wrong thing, or shows an error.",
  FEEDBACK: "An idea, a complaint or a compliment. We read every one.",
};

export const TOPIC_LABEL: Record<SupportTopic, string> = {
  ACCOUNT: "Signing in and my account",
  CLASSES: "Classes, lessons and bookings",
  TESTS: "Tests, assignments and marks",
  PAYMENTS: "Fees and payments",
  SUBSCRIPTION: "Nexa plan and billing",
  APP: "Using the app (pages, errors, speed)",
  OTHER: "Something else",
};

export const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: "Waiting for an answer",
  ANSWERED: "Answered",
  CLOSED: "Closed",
};

/** For staff lists, where the point of view is the other way round. */
export const STAFF_STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: "Needs an answer",
  ANSWERED: "Waiting for them",
  CLOSED: "Closed",
};

export const SUPPORT_LIMITS = {
  subjectMax: 140,
  bodyMax: 5000,
  attachmentsMax: 3,
  attachmentBytesMax: 5 * 1024 * 1024,
  attachmentTypes: ["image/png", "image/jpeg", "image/webp"] as readonly string[],
  /** Signed in: new queries per person per day. */
  perUserDay: 10,
  /** Public form. */
  perIpHour: 5,
  perEmailDay: 3,
  /** A closed query can be reopened by a reply within this many days. */
  reopenDays: 30,
  /** Closed queries are deleted after this many days (housekeeping). */
  keepDays: 730,
} as const;

/** Topics a student or parent asks their own organisation about. */
const ORGANISATION_TOPICS: ReadonlySet<SupportTopic> = new Set(["CLASSES", "TESTS", "PAYMENTS"]);

/**
 * Who should answer, before the person changes it. Students and parents ask
 * their organisation about classes, tests and fees; everything else, and
 * everyone else, goes to Nexa.
 */
export function defaultRoute(persona: SupportPersona, topic: SupportTopic, hasOrganisation: boolean): SupportRoute {
  if (persona !== "learner" && persona !== "guardian") return "NEXA";
  if (!hasOrganisation) return "NEXA";
  return ORGANISATION_TOPICS.has(topic) ? "WORKSPACE" : "NEXA";
}

/** Topics offered to each persona (organisation billing is for staff only). */
export function topicsFor(persona: SupportPersona): SupportTopic[] {
  if (persona === "learner" || persona === "guardian") return SUPPORT_TOPICS.filter((t) => t !== "SUBSCRIPTION");
  if (persona === "public") return ["ACCOUNT", "SUBSCRIPTION", "PAYMENTS", "APP", "OTHER"];
  return [...SUPPORT_TOPICS];
}

export function formatRef(n: number): string {
  return `Q-${n}`;
}

/** Accepts "Q-1042", "q1042" or "1042". */
export function parseRef(ref: string): number | null {
  const m = /^\s*q?-?\s*(\d{1,9})\s*$/i.exec(ref);
  return m ? Number(m[1]) : null;
}

/** A same-site path to keep as "the page they came from"; anything else is dropped. */
export function cleanPagePath(path: string | undefined | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(path)) return null;
  return path.split("#")[0].slice(0, 300);
}

/** The status after a new message, and whether a closed query may be reopened by it. */
export function statusAfterMessage(input: {
  current: SupportStatus;
  fromStaff: boolean;
  internal: boolean;
  closedAt: Date | null;
  now: Date;
}): { status: SupportStatus; allowed: boolean } {
  if (input.internal) return { status: input.current, allowed: true };
  if (input.fromStaff) return { status: "ANSWERED", allowed: true };
  if (input.current === "CLOSED") {
    const closedFor = input.closedAt ? input.now.getTime() - input.closedAt.getTime() : 0;
    if (closedFor > SUPPORT_LIMITS.reopenDays * 86_400_000) return { status: "CLOSED", allowed: false };
  }
  return { status: "OPEN", allowed: true };
}

/** Attachments: our own Blob uploads in the author's own folder only, at most 3. */
export function cleanAttachments(urls: readonly string[] | undefined, authorUserId: string): string[] {
  if (!urls) return [];
  const ok = urls.filter((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.startsWith(`/support/${authorUserId}/`);
    } catch {
      return false;
    }
  });
  return [...new Set(ok)].slice(0, SUPPORT_LIMITS.attachmentsMax);
}

const subject = z.string().trim().min(3, "Add a short subject (at least 3 characters).").max(SUPPORT_LIMITS.subjectMax);
const body = z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(SUPPORT_LIMITS.bodyMax);

export const querySchema = z.object({
  kind: z.enum(SUPPORT_KINDS),
  topic: z.enum(SUPPORT_TOPICS),
  subject,
  message: body,
  route: z.enum(SUPPORT_ROUTES).optional(),
  workspaceId: z.string().min(1).max(64).optional(),
  courseId: z.string().min(1).max(64).optional(),
  pagePath: z.string().max(512).optional(),
  attachments: z.array(z.string().url().max(600)).max(SUPPORT_LIMITS.attachmentsMax).optional(),
});

export const publicQuerySchema = z.object({
  kind: z.enum(SUPPORT_KINDS),
  topic: z.enum(SUPPORT_TOPICS),
  name: z.string().trim().min(2, "Add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Check your email address.").max(254),
  subject,
  message: body,
  pagePath: z.string().max(512).optional(),
  /** When the form was opened (ms), for the bot screen. */
  startedAt: z.number().int().optional(),
  /** Honeypot: must stay empty. */
  website: z.string().max(200).optional(),
});

export const replySchema = z.object({
  id: z.string().min(1).max(64),
  body: z.string().trim().min(1, "Write a reply first.").max(SUPPORT_LIMITS.bodyMax),
  internal: z.boolean().optional(),
  attachments: z.array(z.string().url().max(600)).max(SUPPORT_LIMITS.attachmentsMax).optional(),
});

export type QueryInput = z.input<typeof querySchema>;
export type PublicQueryInput = z.input<typeof publicQuerySchema>;
