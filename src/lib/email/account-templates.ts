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
export type DeletionData = { name: string; deleteOn: string };
export type EmailConfirmData = { name: string };
export type EmailChangedData = { name: string; newEmail: string };

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

export function renderDeletionEmail(d: DeletionData, token: string): Rendered {
  const heading = "Your Nexa account will be deleted";
  const url = absoluteUrl(`/account/cancel-deletion?token=${encodeURIComponent(token)}`);
  const paragraphs = [
    `Hi ${d.name.split(" ")[0] || "there"}, we received a request to delete your Nexa account. It will be deleted on ${d.deleteOn}, and you can't sign in until then.`,
    "Invoices and payments are kept with your name only, as tax law requires. Everything else about you is removed.",
    "If you didn't ask for this, or changed your mind, cancel it before then.",
  ];
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, "Cancel the deletion"), footer: "You're receiving this because someone asked to delete this Nexa account." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nCancel: ${url}\n`,
  };
}

export function renderEmailConfirmEmail(d: EmailConfirmData, token: string): Rendered {
  const heading = "Confirm your new email address";
  const url = absoluteUrl(`/account/confirm-email?token=${encodeURIComponent(token)}`);
  const paragraphs = [`Hi ${d.name.split(" ")[0] || "there"}, confirm that you want to use this address for your Nexa account. The link works for 1 hour.`, "If you didn't ask for this, ignore this email and nothing changes."];
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, "Confirm this address"), footer: "You're receiving this because someone entered this address on a Nexa account." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nConfirm: ${url}\n`,
  };
}

export function renderEmailChangedEmail(d: EmailChangedData, token: string): Rendered {
  const heading = "Your Nexa email address was changed";
  const url = absoluteUrl(`/account/revert-email?token=${encodeURIComponent(token)}`);
  const paragraphs = [`Hi ${d.name.split(" ")[0] || "there"}, the email address on your Nexa account was changed to ${d.newEmail}.`, "If this wasn't you, put this address back within 7 days. That also signs everyone out of the account."];
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, "This wasn't me"), footer: "You're receiving this because this address was on a Nexa account." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nThis wasn't me: ${url}\n`,
  };
}
