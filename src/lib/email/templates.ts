/**
 * Email bodies. Simple HTML with inline styles so it renders the same in
 * Gmail, Outlook and Apple Mail, plus a plain-text alternative. Colours
 * follow the Inkwell palette (slate, parchment, terracotta).
 */

import "server-only";

import { APP_NAME } from "@/lib/branding";

import { absoluteUrl } from "./config";
import type { EmailMessage } from "./send";

const SLATE = "#1B2A41";
const PARCHMENT = "#FBF7EE";
const TERRACOTTA = "#C16E48";
const TAUPE = "#6B5B3A";
const SAND = "#E8E0CE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: { heading: string; bodyHtml: string; footer: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${PARCHMENT};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${SLATE};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${SAND};border-radius:10px;overflow:hidden;">
    <div style="background:${SLATE};color:${PARCHMENT};padding:18px 24px;border-bottom:3px solid ${TERRACOTTA};font-family:Georgia,serif;font-size:20px;">${escapeHtml(APP_NAME)}</div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:22px;line-height:1.3;">${escapeHtml(opts.heading)}</h1>
      ${opts.bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid ${SAND};color:${TAUPE};font-size:12px;line-height:1.5;">${opts.footer}</div>
  </div>
</body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0 4px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${TERRACOTTA};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">${escapeHtml(label)}</a></p>`;
}

function settingsFooter() {
  return `You're receiving this because email notifications are on for your ${escapeHtml(APP_NAME)} account. <a href="${escapeHtml(absoluteUrl("/dashboard/settings"))}" style="color:${TAUPE};">Change your email settings</a>.`;
}

/* ------------------------------------------------------------------------- */

export function verificationEmail(opts: {
  to: string;
  name: string;
  token: string;
}): EmailMessage {
  const link = absoluteUrl(`/verify-email?token=${encodeURIComponent(opts.token)}`);
  const first = opts.name.split(" ")[0] || "there";
  return {
    to: opts.to,
    subject: `Verify your email for ${APP_NAME}`,
    html: layout({
      heading: "Confirm your email address",
      bodyHtml:
        `<p style="font-size:14px;line-height:1.6;margin:0;">Hi ${escapeHtml(first)}, please confirm that this is your email address so we can send you course notifications.</p>` +
        button(link, "Verify email") +
        `<p style="font-size:12px;color:${TAUPE};margin-top:16px;">This link expires in 24 hours. If the button does not work, paste this into your browser:<br>${escapeHtml(link)}</p>`,
      footer: "If you did not expect this email, you can ignore it.",
    }),
    text: `Hi ${first},\n\nConfirm your email address for ${APP_NAME}:\n${link}\n\nThis link expires in 24 hours. If you did not expect this email, you can ignore it.`,
  };
}

export interface EmailNotificationItem {
  title: string;
  message: string;
  link: string | null;
}

export function notificationEmail(opts: {
  to: string;
  item: EmailNotificationItem;
}): EmailMessage {
  const href = absoluteUrl(opts.item.link ?? "/dashboard/notifications");
  return {
    to: opts.to,
    subject: opts.item.title,
    html: layout({
      heading: opts.item.title,
      bodyHtml:
        `<p style="font-size:14px;line-height:1.6;margin:0;">${escapeHtml(opts.item.message)}</p>` +
        button(href, `Open in ${APP_NAME}`),
      footer: settingsFooter(),
    }),
    text: `${opts.item.title}\n\n${opts.item.message}\n\n${href}\n\nChange your email settings: ${absoluteUrl("/dashboard/settings")}`,
  };
}

export function digestEmail(opts: {
  to: string;
  period: "daily" | "weekly";
  items: EmailNotificationItem[];
}): EmailMessage {
  const label = opts.period === "daily" ? "Your daily summary" : "Your weekly summary";
  const rows = opts.items
    .map(
      (i) =>
        `<li style="margin:0 0 12px;"><a href="${escapeHtml(absoluteUrl(i.link ?? "/dashboard/notifications"))}" style="color:${SLATE};font-weight:600;text-decoration:none;">${escapeHtml(i.title)}</a><br><span style="color:${TAUPE};font-size:13px;">${escapeHtml(i.message)}</span></li>`,
    )
    .join("");
  const count = opts.items.length;
  return {
    to: opts.to,
    subject: `${label}: ${count} update${count === 1 ? "" : "s"}`,
    html: layout({
      heading: label,
      bodyHtml:
        `<ul style="padding-left:18px;margin:0;font-size:14px;line-height:1.5;">${rows}</ul>` +
        button(absoluteUrl("/dashboard/notifications"), "View all notifications"),
      footer: settingsFooter(),
    }),
    text: `${label}\n\n${opts.items
      .map((i) => `- ${i.title}: ${i.message}`)
      .join("\n")}\n\n${absoluteUrl("/dashboard/notifications")}`,
  };
}
