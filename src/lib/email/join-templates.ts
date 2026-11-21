/**
 * Join request emails (#206): staff hear about a new request; the person
 * who asked hears whether it was approved or declined.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type JoinTemplate = "requested" | "approved" | "declined";
export type JoinTemplateData = {
  requested: { studentName: string; courseName: string; byParent: boolean };
  approved: { studentName: string; courseName: string; workspaceName: string; forChild: boolean };
  declined: { studentName: string; courseName: string; workspaceName: string; forChild: boolean; reason: string | null };
};

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(t)}</p>`;

function render(heading: string, paragraphs: string[], url: string, label: string, footer: string): Rendered {
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: paragraphs.map(p).join("") + button(url, label), footer }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\n${label}: ${url}\n`,
  };
}

export function renderJoinEmail<T extends JoinTemplate>(template: T, data: JoinTemplateData[T]): Rendered {
  if (template === "requested") {
    const d = data as JoinTemplateData["requested"];
    const who = d.byParent ? `A parent asked for ${d.studentName}` : `${d.studentName} asked`;
    return render(
      `New request to join ${d.courseName}`,
      [`${who} to join ${d.courseName}.`, "Approve or decline it in your join requests."],
      absoluteUrl("/dashboard/join-requests"), "Review the request",
      "You're receiving this because you teach this course on Nexa.",
    );
  }
  if (template === "approved") {
    const d = data as JoinTemplateData["approved"];
    const subject = d.forChild ? `${d.studentName} joined ${d.courseName}` : `You joined ${d.courseName}`;
    return render(
      subject,
      [`${d.workspaceName} approved the request to join ${d.courseName}.`, d.forChild ? `${d.studentName} can now see the course on Nexa.` : "The course is now on your dashboard."],
      absoluteUrl("/dashboard"), "Open Nexa",
      "You're receiving this because you asked to join a course on Nexa.",
    );
  }
  const d = data as JoinTemplateData["declined"];
  const paragraphs = [`${d.workspaceName} declined the request for ${d.forChild ? d.studentName : "you"} to join ${d.courseName}.`];
  if (d.reason) paragraphs.push(`Their note: ${d.reason}`);
  paragraphs.push("You can look for other courses on Nexa.");
  return render(
    `Your request to join ${d.courseName}`,
    paragraphs,
    absoluteUrl("/dashboard/courses/browse"), "Browse courses",
    "You're receiving this because you asked to join a course on Nexa.",
  );
}
