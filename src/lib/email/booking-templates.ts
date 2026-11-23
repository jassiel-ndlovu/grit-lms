/**
 * Session booking emails (#216 phase 2, Plus): confirmed, cancelled and the
 * day-before reminder, to the tutor, the student or a parent.
 */

import "server-only";

import type { Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type BookingTemplate = "confirmed" | "cancelled" | "reminder";

export type BookingEmailData = {
  recipientName: string;
  /** Who's reading: changes "you" and "your child". */
  role: "tutor" | "student" | "parent";
  studentName: string;
  tutorName: string;
  courseName: string;
  workspaceName: string;
  /** Already formatted in the workspace's time zone, e.g. "Tue 25 Nov, 15:00–16:00". */
  when: string;
  meetingLink: string | null;
  note: string | null;
  /** cancelled only */
  cancelledBy?: string | null;
  reason?: string | null;
  creditReturned?: boolean;
};

const first = (n: string) => n.trim().split(/\s+/)[0] || n;

function lessonWith(d: BookingEmailData): string {
  if (d.role === "tutor") return `${first(d.studentName)}'s ${d.courseName} lesson`;
  if (d.role === "parent") return `${first(d.studentName)}'s ${d.courseName} lesson with ${d.tutorName}`;
  return `your ${d.courseName} lesson with ${d.tutorName}`;
}

export function renderBookingEmail(template: BookingTemplate, d: BookingEmailData): Rendered {
  const what = lessonWith(d);
  const cap = what.charAt(0).toUpperCase() + what.slice(1);
  const heading =
    template === "confirmed" ? `Booked: ${d.when}` : template === "cancelled" ? `Cancelled: ${d.when}` : `Tomorrow: ${d.when}`;
  const lines: string[] = [];
  if (template === "confirmed") lines.push(`${cap} is booked for ${d.when}.`);
  if (template === "reminder") lines.push(`A reminder: ${what} is on ${d.when}.`);
  if (template === "cancelled") {
    lines.push(`${cap} on ${d.when} was cancelled${d.cancelledBy ? ` by ${d.cancelledBy}` : ""}.`);
    if (d.reason) lines.push(`Reason: ${d.reason}`);
    if (d.role !== "tutor" && d.creditReturned != null) {
      lines.push(d.creditReturned ? "The lesson is back on the pack, so it can be booked again." : "It was cancelled late, so the lesson wasn't returned to the pack. Ask the tutor if you think it should be.");
    }
  }
  if (template !== "cancelled" && d.meetingLink) lines.push(`Join online: ${d.meetingLink}`);
  if (template !== "cancelled" && d.note) lines.push(`Note: ${d.note}`);
  const html = layout({
    heading,
    bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first(d.recipientName))},</p>
${lines.map((l) => `<p style="margin:0 0 12px;">${escapeHtml(l)}</p>`).join("\n")}
${button(absoluteUrl("/dashboard/bookings"), template === "cancelled" ? "Book another time" : "See your bookings")}`,
    footer: `${escapeHtml(d.workspaceName)} through Nexa LMS.`,
  });
  const text = [`Hi ${first(d.recipientName)},`, "", ...lines, "", absoluteUrl("/dashboard/bookings")].join("\n");
  return { subject: `${heading} · ${d.courseName}`, html, text };
}
