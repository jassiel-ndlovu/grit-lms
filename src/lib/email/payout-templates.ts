/**
 * Emails to payees (tutors, or the workspace's owners in WORKSPACE payout
 * mode) about recovering a refund Nexa funded: the notice before any
 * deduction, the invoice offer after 60 days without a payout, and the
 * confirmation once it is repaid. Rendered by the send queue.
 */

import "server-only";

import { rands, type Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type PayoutTemplateData = {
  "recovery-notice": {
    payeeName: string; invoiceNumber: string; studentName: string; refundCents: number; owedCents: number;
    reason: string; deductFromOn: string; maxSharePercent: number;
  };
  "recovery-invoice": { payeeName: string; invoiceNumber: string; outstandingCents: number; payPath: string; days: number };
  "recovery-repaid": { payeeName: string; invoiceNumber: string; owedCents: number };
};
export type PayoutTemplate = keyof PayoutTemplateData;

const footer = () => "You're receiving this because you receive fee payments through Nexa. Payout emails can't be switched off. Questions: reply to this email.";

function render(heading: string, paragraphs: string[], cta?: { path: string; label: string }): Rendered {
  const url = cta ? absoluteUrl(cta.path) : null;
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`).join("");
  return {
    subject: heading,
    html: layout({ heading, bodyHtml: body + (url && cta ? button(url, cta.label) : ""), footer: footer() }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}${url && cta ? `\n\n${cta.label}: ${url}` : ""}\n`,
  };
}

export function renderPayoutEmail<T extends PayoutTemplate>(template: T, data: PayoutTemplateData[T]): Rendered {
  if (template === "recovery-notice") {
    const d = data as PayoutTemplateData["recovery-notice"];
    return render(`Notice of deduction: ${rands(d.owedCents)} for a refund`, [
      `Hello ${d.payeeName},`,
      `After reviewing a request, Nexa refunded ${rands(d.refundCents)} of invoice ${d.invoiceNumber} (${d.studentName}) to the payer. Reason: ${d.reason}`,
      `Nexa paid this refund from its own account. Your share of it is ${rands(d.owedCents)}: the part of the payment that was sent to you. Nexa's commission on that amount is not charged to you.`,
      `From ${d.deductFromOn}, we'll recover it from your next fee payouts, taking no more than ${d.maxSharePercent}% of any one payout, until it is repaid. Nothing is taken from your bank account directly.`,
      "If you think this is wrong, reply to this email before then and we'll hold the deduction while we look at it again.",
    ], { path: "/dashboard/fees", label: "View your fees" });
  }
  if (template === "recovery-invoice") {
    const d = data as PayoutTemplateData["recovery-invoice"];
    return render(`Invoice: ${rands(d.outstandingCents)} still owed for a refund`, [
      `Hello ${d.payeeName},`,
      `You still owe ${rands(d.outstandingCents)} for the refund of invoice ${d.invoiceNumber}. You haven't received a fee payout through Nexa in the last ${d.days} days, so we can't recover it from your payouts.`,
      "You can pay it by card now. If you receive payouts again first, we'll keep recovering it from those instead, and you'll only ever be asked for what is still owed.",
    ], { path: d.payPath, label: "Pay by card" });
  }
  const d = data as PayoutTemplateData["recovery-repaid"];
  return render(`Repaid: ${rands(d.owedCents)} for invoice ${d.invoiceNumber}`, [
    `Hello ${d.payeeName},`,
    `The ${rands(d.owedCents)} for the refund of invoice ${d.invoiceNumber} is fully repaid. Your payouts are back to normal. Thank you.`,
  ]);
}
