/**
 * Help and contact centre emails (owner 24 Nov). Contract: support.md.
 *
 *   support:staff      to the Nexa support inbox: a new query or a reply
 *   support:requester  to someone who used the public form: the
 *                      confirmation, and each answer, with their private link
 *
 * Signed-in people get answers as ordinary notifications instead.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type SupportStaffData = {
  ref: string; subject: string; topic: string; name: string; email: string;
  event: "new" | "reply"; preview: string; link: string;
};

export type SupportRequesterData = {
  ref: string; subject: string; name: string;
  event: "received" | "answered"; preview: string; answeredBy: string; link: string;
};

const quote = (s: string) =>
  `<div style="padding:12px 14px;border-left:3px solid #e5dccb;background:#faf7f2;font-size:14px;line-height:1.5;">${escapeHtml(s).replace(/\n/g, "<br>")}</div>`;

export function renderSupportStaffEmail(d: SupportStaffData): Rendered {
  const heading = d.event === "new" ? `New query ${d.ref} from ${d.name}` : `${d.name} replied on ${d.ref}`;
  const html = layout({
    heading,
    bodyHtml: `<p style="margin:0 0 8px;font-size:14px;"><strong>${escapeHtml(d.subject)}</strong></p>
<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${escapeHtml(d.topic)} · ${escapeHtml(d.email)}</p>
${quote(d.preview)}
${button(absoluteUrl(d.link), "Open the query")}`,
    footer: "Answer in Nexa so the conversation stays in one place.",
  });
  const text = [heading, "", d.subject, `${d.topic} · ${d.email}`, "", d.preview, "", `Open the query: ${absoluteUrl(d.link)}`].join("\n");
  return { subject: `${d.event === "new" ? "New query" : "Reply"} ${d.ref}: ${d.subject}`, html, text };
}

export function renderSupportRequesterEmail(d: SupportRequesterData): Rendered {
  const first = d.name.split(" ")[0] || d.name;
  const received = d.event === "received";
  const heading = received ? `We've got your query, ${first}` : `${d.answeredBy} replied to your query`;
  const intro = received
    ? `Thanks for getting in touch. Your reference is <strong>${escapeHtml(d.ref)}</strong>. We usually answer within one working day, and we'll email you when we do.`
    : `Here's the latest on <strong>${escapeHtml(d.ref)}</strong>, "${escapeHtml(d.subject)}".`;
  const html = layout({
    heading,
    bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;">${intro}</p>
${quote(d.preview)}
${button(absoluteUrl(d.link), received ? "See your query" : "Read and reply")}`,
    footer: "Keep this email: the button is your private link to this query. Don't forward it.",
  });
  const text = [
    received ? `We've got your query, ${first}. Your reference is ${d.ref}. We usually answer within one working day.` : `${d.answeredBy} replied to your query ${d.ref}, "${d.subject}".`,
    "",
    d.preview,
    "",
    `${received ? "See your query" : "Read and reply"}: ${absoluteUrl(d.link)}`,
  ].join("\n");
  return { subject: received ? `We've got your query (${d.ref})` : `Reply to your query ${d.ref}`, html, text };
}
