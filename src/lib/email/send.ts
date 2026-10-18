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
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
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
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
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
      return { ok: false, error };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[email] send threw:", error);
    return { ok: false, error };
  }
}
