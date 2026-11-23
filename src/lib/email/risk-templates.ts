/**
 * The email when staff share an at-risk alert (#216 phase 2, Pro): to a
 * parent or to the student. The tutor's note first, then the facts.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type RiskSharedData = {
  recipientName: string;
  /** "parent" or "student": changes the wording, not the facts. */
  audience: "parent" | "student";
  studentName: string;
  courseName: string;
  workspaceName: string;
  tutorName: string;
  note: string | null;
  summary: string;
};

export function renderRiskSharedEmail(d: RiskSharedData): Rendered {
  const first = d.recipientName.split(" ")[0] || "there";
  const child = d.studentName.split(" ")[0] || d.studentName;
  const heading = d.audience === "parent" ? `How ${child} is doing in ${d.courseName}` : `How you're doing in ${d.courseName}`;
  const intro =
    d.audience === "parent"
      ? `${d.tutorName} at ${d.workspaceName} wanted you to know how ${child} is doing in ${d.courseName}, so you can help early.`
      : `${d.tutorName} at ${d.workspaceName} wanted you to know how you're doing in ${d.courseName}, so you can catch up early.`;
  const note = d.note
    ? `<p style="margin:0 0 12px;padding:12px 14px;border-left:3px solid #e5dccb;background:#faf7f2;">${escapeHtml(d.note).replace(/\n/g, "<br>")}<br><span style="color:#6b7280;font-size:13px;">${escapeHtml(d.tutorName)}</span></p>`
    : "";
  const html = layout({
    heading,
    bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 12px;">${escapeHtml(intro)}</p>
${note}<p style="margin:0 0 12px;">${escapeHtml(d.summary)}</p>
<p style="margin:0 0 12px;">You can reply to ${escapeHtml(d.tutorName)} in Nexa's messages.</p>
${button(absoluteUrl("/dashboard"), "Open Nexa")}`,
    footer: `Sent by ${escapeHtml(d.tutorName)} at ${escapeHtml(d.workspaceName)} through Nexa LMS.`,
  });
  const text = [
    `Hi ${first},`,
    "",
    intro,
    "",
    ...(d.note ? [d.note, `– ${d.tutorName}`, ""] : []),
    d.summary,
    "",
    `You can reply to ${d.tutorName} in Nexa's messages: ${absoluteUrl("/dashboard")}`,
  ].join("\n");
  return { subject: heading, html, text };
}
