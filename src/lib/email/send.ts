/**
 * Thin Resend client over its REST API (no SDK dependency).
 *
 * `sendEmail` never throws: email is a side channel, and a failed send must
 * not fail the action that triggered it. It returns `{ ok: false }` with
 * the reason so callers can decide whether to record the email as sent.
 */

import "server-only";

import { EMAIL_FROM, EMAIL_REPLY_TO, RESEND_API_KEY } from "./config";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Overrides EMAIL_REPLY_TO for this message (the enquirer, for enquiry emails). */
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  /** `httpStatus` is set when Resend answered; the queue retries 429, 409 and 5xx. */
  | { ok: false; error: string; httpStatus?: number };

/**
 * Outside production only addresses in EMAIL_ALLOWLIST (comma separated,
 * set in the environment, never in the repo) may be mailed by the queue.
 * Design 05, "Non-production guard".
 */
export function recipientAllowed(email: string, env: Record<string, string | undefined> = process.env): boolean {
  // Placeholder addresses (students without email, deleted accounts) end in .invalid and never receive mail.
  if (/\.invalid$/i.test(email.trim())) return false;
  if (env.VERCEL_ENV === "production") return true;
  const allow = (env.EMAIL_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

export async function sendEmail(message: EmailMessage, opts: { idempotencyKey?: string } = {}): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set; skipping send to", message.to);
    return { ok: false, error: "Email is not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...((message.replyTo ?? EMAIL_REPLY_TO) ? { reply_to: message.replyTo ?? EMAIL_REPLY_TO } : {}),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok || !body.id) {
      // With the dev sender, any recipient other than the Resend account
      // owner lands here with a 403.
      const error = body.message ?? `Resend responded ${res.status}`;
      console.warn("[email] send failed:", message.to, error);
      return { ok: false, error, httpStatus: res.status };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[email] send threw:", error);
    return { ok: false, error };
  }
}
