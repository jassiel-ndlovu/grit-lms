/**
 * API keys and webhooks (#216 phase 3, Pro): the pure parts, covered by
 * scripts/check-api.ts. Keys, scopes, webhook URL safety, signatures,
 * retry timing and cursors. node:crypto only.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const API_SCOPES = ["courses.read", "learners.read", "grades.read", "attendance.read", "invoices.read", "bookings.read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_LABEL: Record<ApiScope, string> = {
  "courses.read": "Courses and lessons (titles and dates)",
  "learners.read": "Students and enrolments",
  "grades.read": "Marks",
  "attendance.read": "Attendance",
  "invoices.read": "Fee invoices and payments",
  "bookings.read": "Booked lessons",
};

export const WEBHOOK_EVENTS = [
  "enrolment.created", "enrolment.ended", "invoice.paid", "booking.created", "booking.cancelled",
  "attendance.marked", "risk_alert.opened", "grade.released",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const API_LIMITS = {
  /** Requests a minute per key. */
  perMinute: 120,
  /** Keys per workspace (active). */
  keysPerWorkspace: 10,
  /** Webhook endpoints per workspace. */
  endpointsPerWorkspace: 5,
  /** Page size. */
  maxLimit: 100,
  defaultLimit: 50,
  /** Webhook request timeout. */
  webhookTimeoutMs: 8_000,
  /** A failing endpoint is switched off after this long. */
  disableAfterMs: 3 * 86_400_000,
  /** Delivery rows are kept this long. */
  keepDeliveriesDays: 30,
} as const;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function base62(bytes: Buffer): string {
  let out = "";
  for (const b of bytes) out += BASE62[b % 62];
  return out;
}

/** A new key: shown once. "nexa_live_" + 32 random characters. */
export function newApiKey(): { key: string; prefix: string; hash: string } {
  const key = `nexa_live_${base62(randomBytes(32))}`;
  return { key, prefix: key.slice(0, 14), hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** The key from an Authorization header ("Bearer nexa_live_…"), or null. */
export function bearerKey(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(nexa_live_[0-9A-Za-z]{32})$/.exec((header ?? "").trim());
  return m ? m[1] : null;
}

export function validScopes(scopes: string[]): ApiScope[] {
  return [...new Set(scopes)].filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
}

/** A new webhook signing secret: shown once. */
export function newWebhookSecret(): { secret: string; prefix: string } {
  const secret = `whsec_${base62(randomBytes(32))}`;
  return { secret, prefix: secret.slice(0, 10) };
}

/**
 * The Nexa-Signature header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}`>".
 * Receivers recompute it with their secret and reject old timestamps.
 */
export function signPayload(secret: string, body: string, unixSeconds: number): string {
  const v1 = createHmac("sha256", secret).update(`${unixSeconds}.${body}`).digest("hex");
  return `t=${unixSeconds},v1=${v1}`;
}

/** For receivers and tests: true when the header matches and is within `toleranceSeconds`. */
export function verifySignature(secret: string, body: string, header: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const want = Buffer.from(signPayload(secret, body, t).split("v1=")[1], "hex");
  const got = Buffer.from(parts.v1, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Minutes before attempt n+1 after n failed attempts; null to give up. */
export const WEBHOOK_RETRY_MINUTES = [1, 5, 30, 120, 720, 1440] as const;
export function webhookRetryMinutes(attempts: number): number | null {
  return attempts >= 1 && attempts <= WEBHOOK_RETRY_MINUTES.length ? WEBHOOK_RETRY_MINUTES[attempts - 1] : null;
}

/** True for an IP address webhooks must never reach: private, loopback, link-local, CGNAT, multicast, reserved. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    if (s.startsWith("::ffff:")) return isPrivateAddress(s.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

/** Checks a webhook URL before saving: https, a public host name, no credentials, standard port. Returns an error for people, or null. */
export function webhookUrlProblem(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "Enter a full https:// address."; }
  if (u.protocol !== "https:") return "Webhook addresses must start with https://.";
  if (u.username || u.password) return "Leave the user name and password out of the address.";
  if (u.port && u.port !== "443") return "Use the standard https port.";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isPrivateAddress(host) ? "That address is on a private network." : "Use a host name, not an IP address.";
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|lan|home|corp)$/i.test(host)) return "That address isn't reachable from the internet.";
  if (/(^|\.)nexa-lms\.co\.za$|(^|\.)vercel\.app$/i.test(host)) return "Point webhooks at your own server.";
  return null;
}

/** Opaque page cursor: base64url of the last row's sort key and id. */
export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.getTime()}:${id}`).toString("base64url");
}
export function decodeCursor(c: string | null | undefined): { at: Date; id: string } | null {
  if (!c) return null;
  try {
    const [ms, id] = Buffer.from(c, "base64url").toString("utf8").split(":");
    const n = Number(ms);
    return Number.isFinite(n) && id ? { at: new Date(n), id } : null;
  } catch {
    return null;
  }
}

/** The rate limit: whether this request fits, and the next counter state. */
export function rateStep(state: { minuteStart: Date | null; minuteCount: number }, now: Date, limit: number = API_LIMITS.perMinute): { ok: boolean; minuteStart: Date; minuteCount: number; resetSeconds: number } {
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const same = state.minuteStart?.getTime() === start.getTime();
  const count = (same ? state.minuteCount : 0) + 1;
  return { ok: count <= limit, minuteStart: start, minuteCount: count, resetSeconds: Math.ceil((start.getTime() + 60_000 - now.getTime()) / 1000) };
}
