/**
 * Staff emails (#216 phase 3, organisations): cover assigned.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type CoverAssignedData = {
  recipientName: string;
  absentName: string;
  courseName: string;
  workspaceName: string;
  when: string;
  reason: string | null;
  courseId: string;
};

export function renderCoverAssignedEmail(d: CoverAssignedData): Rendered {
  const first = d.recipientName.split(" ")[0] || "there";
  const lines = [
    `You're covering ${d.courseName} on ${d.when}, for ${d.absentName}.`,
    ...(d.reason ? [`Reason given: ${d.reason}`] : []),
    "You can open the course to see the class, its lessons and the register until the day after.",
  ];
  const link = absoluteUrl(`/dashboard/courses/${d.courseId}`);
  return {
    subject: `Cover: ${d.courseName}, ${d.when}`,
    html: layout({
      heading: `You're covering ${d.courseName}`,
      bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)},</p>${lines.map((l) => `<p style="margin:0 0 12px;">${escapeHtml(l)}</p>`).join("")}${button(link, "Open the course")}`,
      footer: `${escapeHtml(d.workspaceName)} through Nexa LMS.`,
    }),
    text: [`Hi ${first},`, "", ...lines, "", link].join("\n"),
  };
}
