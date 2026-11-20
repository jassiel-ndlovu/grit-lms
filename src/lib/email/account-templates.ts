/**
 * Account emails (design 02, section 5): a staff invite, and the note to an
 * existing account when a tutor links a child to it. Rendered by the send
 * queue; the invite token is sealed in the queued row and removed after.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type InviteData = { inviterName: string; workspaceName: string; role: "ADMIN" | "TUTOR"; expiresOn: string };
export type GuardianLinkedData = { tutorName: string; studentName: string; workspaceName: string };

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(t)}</p>`;

export function renderInviteEmail(d: InviteData, token: string): Rendered {
  const role = d.role === "ADMIN" ? "an admin" : "a tutor";
  const heading = `${d.inviterName} invited you to join ${d.workspaceName} on Nexa`;
  const url = absoluteUrl(`/auth/invite/${encodeURIComponent(token)}`);
  const paragraphs = [`${d.inviterName} invited you to join ${d.workspaceName} as ${role}.`, `The invitation expires on ${d.expiresOn}.`];
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, "Accept invitation"), footer: "If you weren't expecting this, you can ignore it." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nAccept: ${url}\n`,
  };
}

export function renderGuardianLinkedEmail(d: GuardianLinkedData): Rendered {
  const heading = `${d.studentName} was added to your Nexa account`;
  const url = absoluteUrl("/dashboard");
  const paragraphs = [`${d.tutorName} at ${d.workspaceName} linked ${d.studentName} to your account. You can now follow their progress and pay their fees.`, "If this is a mistake, let the tutor know."];
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, "Open Nexa"), footer: "You're receiving this because a tutor linked a student to your Nexa account." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nOpen Nexa: ${url}\n`,
  };
}
