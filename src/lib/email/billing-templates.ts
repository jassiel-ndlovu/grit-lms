/**
 * Billing emails to workspace owners and admins (design 05, section 4;
 * design 03, sections 6 and 7). Rendered by the send queue from the data
 * stored on the OutboundEmail row, so each takes plain JSON.
 */

import "server-only";

import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type Rendered = { subject: string; html: string; text: string };

export type BillingTemplateData = {
  "trial-ending": { workspaceName: string; daysLeft: number; trialEndsOn: string };
  "trial-ended": { workspaceName: string };
  dunning: { workspaceName: string; day: 0 | 3 | 7; invoiceNumber: string; totalCents: number; readOnlyOn: string };
  "read-only": { workspaceName: string; invoiceNumber: string; totalCents: number };
  receipt: { workspaceName: string; invoiceNumber: string; totalCents: number; paidOn: string; renewsOn: string; cardLast4: string | null };
  "deletion-warning": { workspaceName: string; daysLeft: number; deleteOn: string };
  /** A usage limit at 80% or 100% (design 03, section 8). */
  "cap-warning": { workspaceName: string; what: string; used: number; limit: number; level: 80 | 100; hardStop: boolean; trial: boolean };
};

export type BillingTemplate = keyof BillingTemplateData;

/** R1,234.50 */
export function rands(cents: number): string {
  const r = (cents / 100).toFixed(2).split(".");
  return `R${r[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${r[1]}`;
}

const BILLING_PATH = "/dashboard/settings/billing";
const footer = () =>
  `You're receiving this because you manage billing for this ${escapeHtml("Nexa")} workspace. Billing emails can't be switched off.`;

function render(heading: string, paragraphs: string[], cta: string): Rendered & { heading: string } {
  const url = absoluteUrl(BILLING_PATH);
  const bodyHtml = paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`).join("") + button(url, cta);
  return {
    heading,
    subject: heading,
    html: layout({ heading, bodyHtml, footer: footer() }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\n${cta}: ${url}\n`,
  };
}

export function renderBillingEmail<T extends BillingTemplate>(template: T, data: BillingTemplateData[T]): Rendered {
  switch (template) {
    case "trial-ending": {
      const d = data as BillingTemplateData["trial-ending"];
      return render(
        d.daysLeft <= 1 ? `Your Nexa trial ends tomorrow` : `Your Nexa trial ends in ${d.daysLeft} days`,
        [
          `The free trial for ${d.workspaceName} ends on ${d.trialEndsOn}.`,
          "Your courses are on Pro, with every feature on. If you don't need all of them, you can move any course to Core or Plus, which cost less, on the billing page before you pay.",
          "You can pay now: your first 30 days start when the trial ends, so you keep the rest of your trial. After the trial, staff can still sign in, but can't make changes until the bill is paid. Students are never blocked.",
        ],
        "Review plans and pay",
      );
    }
    case "trial-ended": {
      const d = data as BillingTemplateData["trial-ended"];
      return render(
        "Your Nexa trial has ended",
        [
          `The trial for ${d.workspaceName} is over, so the workspace is read-only for staff. Students can still take tests and submit work.`,
          "Pay for your first 30 days and everything opens again straight away. Your courses are on Pro; if you'd like a cheaper plan, move any course to Core or Plus on the billing page before you pay.",
        ],
        "Review plans and pay",
      );
    }
    case "dunning": {
      const d = data as BillingTemplateData["dunning"];
      const lead =
        d.day === 0 ? "We couldn't take the payment for your Nexa renewal."
        : d.day === 3 ? "We tried your card again and the payment still didn't go through."
        : "Final notice: we still couldn't take the payment for your Nexa renewal.";
      return render(
        d.day === 7 ? `Final notice: ${d.workspaceName} goes read-only on ${d.readOnlyOn}` : `Payment failed for ${d.workspaceName}`,
        [
          lead,
          `Invoice ${d.invoiceNumber} for ${rands(d.totalCents)} is unpaid. Pay now, or add a new card, before ${d.readOnlyOn}. After that the workspace is read-only for staff until it is paid. Students are never blocked.`,
        ],
        "Pay now",
      );
    }
    case "cap-warning": {
      const d = data as BillingTemplateData["cap-warning"];
      const full = d.level === 100;
      const stop = d.hardStop
        ? d.trial ? "During the trial nothing more can be added until you pay for your first 30 days." : "Nothing more can be added this period unless you raise the limit."
        : "Nothing stops at the limit; it's a warning only.";
      return render(
        full ? `${d.workspaceName} has reached its ${d.what} limit` : `${d.workspaceName} has used ${d.level}% of its ${d.what} limit`,
        [`${d.workspaceName} is at ${d.used} of ${d.limit} ${d.what}.`, full ? stop : `At ${d.limit}, ${stop.charAt(0).toLowerCase()}${stop.slice(1)}`],
        d.trial ? "Choose plans and pay" : "Review usage",
      );
    }
    case "read-only": {
      const d = data as BillingTemplateData["read-only"];
      return render(
        `${d.workspaceName} is now read-only`,
        [
          `Invoice ${d.invoiceNumber} for ${rands(d.totalCents)} was not paid within 14 days, so staff can no longer make changes. Students can still take tests and submit work.`,
          "Pay the invoice and everything opens again straight away.",
        ],
        "Pay now",
      );
    }
    case "receipt": {
      const d = data as BillingTemplateData["receipt"];
      return render(
        `Receipt for ${d.invoiceNumber}`,
        [
          `Thank you. We received ${rands(d.totalCents)} for ${d.workspaceName} on ${d.paidOn}${d.cardLast4 ? ` from the card ending ${d.cardLast4}` : ""}.`,
          `This pays for 30 days. The next renewal is on ${d.renewsOn}.`,
        ],
        "View billing",
      );
    }
    case "deletion-warning": {
      const d = data as BillingTemplateData["deletion-warning"];
      return render(
        `${d.workspaceName} will be deleted on ${d.deleteOn}`,
        [
          `${d.workspaceName} has had no payment for almost two months, so its courses, content and student records will be deleted on ${d.deleteOn} (${d.daysLeft} days from now).`,
          "Pay any time before then and everything stays as it is. Invoices and payment records are kept, as the law requires.",
        ],
        "Pay and keep the workspace",
      );
    }
    default:
      throw new Error(`Unknown billing template ${String(template)}`);
  }
}
