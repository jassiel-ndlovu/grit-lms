/**
 * Emails to parents (#216, phase 1): the weekly summary of each child's
 * marks, work due and attendance.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type WeeklySummaryData = {
  parentName: string;
  weekOf: string;
  children: Array<{
    name: string;
    marks: Array<{ course: string; title: string; score: number; outOf: number }>;
    due: Array<{ kind: "test" | "assignment"; title: string; course: string; dueOn: string; done: boolean }>;
    attendance: { present: number; late: number; absent: number; excused: number };
  }>;
};

const pct = (s: number, o: number) => (o > 0 ? `${Math.round((s / o) * 100)}%` : "");
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function attendanceLine(a: WeeklySummaryData["children"][number]["attendance"]): string | null {
  const parts = [
    a.present ? `${a.present} present` : "",
    a.late ? `${a.late} late` : "",
    a.absent ? `${a.absent} absent` : "",
    a.excused ? `${a.excused} excused` : "",
  ].filter(Boolean);
  return parts.length ? `Attendance: ${parts.join(", ")}.` : null;
}

export function renderWeeklySummaryEmail(d: WeeklySummaryData): Rendered {
  const first = d.parentName.split(" ")[0] || "there";
  const names = d.children.map((c) => c.name.split(" ")[0]);
  const heading = `${names.length === 1 ? `${names[0]}'s` : "Your children's"} week on Nexa`;
  const h = (t: string) => `<h2 style="margin:20px 0 8px;font-size:16px;">${escapeHtml(t)}</h2>`;
  const p = (t: string) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.55;">${escapeHtml(t)}</p>`;
  const li = (items: string[]) => `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.55;">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;

  const html: string[] = [p(`Hi ${first}, here's the week of ${d.weekOf}.`)];
  const text: string[] = [`Hi ${first}, here's the week of ${d.weekOf}.`];
  for (const c of d.children) {
    html.push(h(c.name));
    text.push("", c.name.toUpperCase());
    if (c.marks.length) {
      const items = c.marks.map((m) => `${m.course}: ${m.title}, ${fmt(m.score)}/${fmt(m.outOf)} ${pct(m.score, m.outOf) ? `(${pct(m.score, m.outOf)})` : ""}`.trim());
      html.push(p("New marks:"), li(items));
      text.push("New marks:", ...items.map((i) => `- ${i}`));
    }
    if (c.due.length) {
      const items = c.due.map((x) => `${x.dueOn}: ${x.course}, ${x.kind} "${x.title}"${x.done ? " (done)" : ""}`);
      html.push(p("Due this week:"), li(items));
      text.push("Due this week:", ...items.map((i) => `- ${i}`));
    }
    const att = attendanceLine(c.attendance);
    if (att) { html.push(p(att)); text.push(att); }
  }
  const url = absoluteUrl("/dashboard");
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: html.join("") + button(url, "Open Nexa"), footer: "You get this every Monday as a parent on Nexa. Turn it off in Settings, Notifications (email)." }),
    text: `${heading}\n\n${text.join("\n")}\n\nOpen Nexa: ${url}\n`,
  };
}
