/**
 * Branding and white-label rules (#216 phase 3): the pure parts, covered by
 * scripts/check-branding.ts. Plus: logo, accent colour and sender name.
 * Pro: white-label (no Nexa name in families' emails or the branded pages).
 * Custom domains are on hold (owner, 24 Nov).
 */

import type { Rendered } from "@/lib/email/billing-templates";

export type EmailBrand = { name: string; senderName: string; logoUrl: string | null; accentColor: string | null; whiteLabel: boolean };

/** Templates that go to a workspace's families and staff, and so carry its brand. Nexa's own (billing, accounts, payouts) never do. */
const BRANDED = [/^fees:/, /^parent:/, /^join:/, /^attendance:/, /^risk:/, /^booking:/, /^staff:/, /^enquiry:reply$/, /^notification$/, /^digest$/];
export function brandedTemplate(template: string): boolean {
  return BRANDED.some((r) => r.test(template));
}

export function validAccent(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

/** A display name safe for an email From header: no angle brackets, quotes, commas or line breaks. */
export function cleanSenderName(s: string): string {
  return s.replace(/[<>"\r\n,;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** "Name <addr>" from EMAIL_FROM, with a new display name. */
export function fromWithName(emailFrom: string, name: string): string {
  const m = /<([^>]+)>/.exec(emailFrom);
  const addr = m ? m[1] : emailFrom.trim();
  return `${cleanSenderName(name)} <${addr}>`;
}

/** The From name: "<sender> via Nexa" on Plus, just "<sender>" when white-labelled. */
export function senderLabel(b: EmailBrand): string {
  const s = cleanSenderName(b.senderName || b.name);
  return b.whiteLabel ? s : `${s} via Nexa`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Puts the workspace's brand on a rendered email: its name (and logo) in the
 * header and its accent colour; when white-labelled, every "Nexa LMS" and
 * "Nexa" in the subject, text and HTML becomes the workspace's name.
 */
export function applyBrand<T extends Rendered>(r: T, b: EmailBrand, appName = "Nexa LMS"): T {
  let html = r.html;
  const header = `${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="" height="28" style="height:28px;vertical-align:middle;margin-right:10px;border:0;">` : ""}${esc(b.name)}`;
  html = html.replace(`font-size:20px;">${esc(appName)}</div>`, `font-size:20px;">${header}</div>`);
  if (b.accentColor && validAccent(b.accentColor)) html = html.replace(/#C16E48|#c16e48/g, b.accentColor);
  if (!b.whiteLabel) return { ...r, html };
  // "X through Nexa LMS." footers would read "X through X.": drop the phrase first.
  const swap = (s: string) => s.replace(/ through Nexa LMS/g, "").replace(new RegExp(appName.replace(/ /g, "\\s"), "g"), b.name).replace(/\bNexa's\b/g, `${b.name}'s`).replace(/\bNexa\b/g, b.name);
  // Tags (and so links) are left alone; "Nexa" is matched case-sensitively, so nexa-lms.co.za in text stays too. Custom domains are on hold.
  const swapHtml = (s: string) => s.split(/(<[^>]+>)/).map((part) => (part.startsWith("<") ? part : swap(part))).join("");
  return { ...r, subject: swap(r.subject), text: swap(r.text), html: swapHtml(html) };
}
