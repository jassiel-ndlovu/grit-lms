/**
 * The email to the Nexa inbox for a landing-page enquiry (#216). Reply-To is
 * the enquirer, so answering the email answers them.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type EnquiryEmailData = {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  students: number | null;
  message: string;
  source: string | null;
};

const KIND_LABEL: Record<string, string> = { ACCESS: "Access request", TEAM: "Organisation enquiry", OTHER: "Enquiry" };

export function renderEnquiryEmail(d: EnquiryEmailData): Rendered & { replyTo: string } {
  const label = KIND_LABEL[d.kind] ?? "Enquiry";
  const rows: Array<[string, string | null]> = [
    ["Name", d.name],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Organisation", d.organisation],
    ["Students", d.students == null ? null : String(d.students)],
    ["From", d.source],
  ];
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  const table = shown
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`)
    .join("");
  const message = escapeHtml(d.message).replace(/\n/g, "<br>");
  const html = layout({
    heading: `${label} from ${d.name}`,
    bodyHtml: `<table style="border-collapse:collapse;font-size:14px;margin:0 0 16px;">${table}</table>
<div style="padding:12px 14px;border-left:3px solid #e5dccb;background:#faf7f2;font-size:14px;line-height:1.5;">${message}</div>
${button(absoluteUrl("/dashboard/admin"), "Open enquiries")}`,
    footer: "Reply to this email to answer them directly. Sent from the form on the Nexa landing page.",
  });
  const text = [
    `${label} from ${d.name}`,
    "",
    ...shown.map(([k, v]) => `${k}: ${v}`),
    "",
    d.message,
    "",
    `Open enquiries: ${absoluteUrl("/dashboard/admin")}`,
  ].join("\n");
  return { subject: `${label}: ${d.name}${d.organisation ? ` (${d.organisation})` : ""}`, html, text, replyTo: d.email };
}
