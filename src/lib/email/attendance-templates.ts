/** Email to a guardian when their child is marked absent (A, #149). Rendered by the send queue. */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type AbsenceData = { studentName: string; title: string; courseName: string; when: string };

export function renderAbsenceEmail(d: AbsenceData): Rendered {
  const heading = `${d.studentName} was marked absent`;
  const paragraphs = [
    `${d.studentName} was marked absent from "${d.title}" (${d.courseName}) on ${d.when}.`,
    "If this is wrong, or they were away for a reason, please let their tutor know.",
  ];
  const url = absoluteUrl("/dashboard");
  return {
    subject: heading,
    html: layout({
      heading,
      bodyHtml: paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`).join("") + button(url, "View attendance"),
      footer: "You're receiving this because you're a parent or guardian on Nexa.",
    }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nView attendance: ${url}\n`,
  };
}
