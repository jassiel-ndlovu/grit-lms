/**
 * Fee emails to payers (guardians, or adult students who see their own
 * fees): a new invoice, an overdue reminder and a receipt. Rendered by the
 * send queue from the stored data.
 */

import "server-only";

import { rands, type Rendered } from "./billing-templates";
import { absoluteUrl } from "./config";
import { button, escapeHtml, layout } from "./templates";

export type FeeTemplateData = {
  invoice: { payeeName: string; studentName: string; number: string; totalCents: number; dueOn: string };
  overdue: { payeeName: string; studentName: string; number: string; totalCents: number; dueOn: string; days: 1 | 7 };
  receipt: { payeeName: string; numbers: string[]; totalCents: number; paidOn: string };
};
export type FeeTemplate = keyof FeeTemplateData;

const FEES_PATH = "/dashboard/fees";
const footer = () => "You're receiving this because you pay fees for this student on Nexa. Fee emails can't be switched off.";

function render(heading: string, paragraphs: string[], cta: string): Rendered {
  const url = absoluteUrl(FEES_PATH);
  return {
    subject: heading,
    html: layout({
      heading,
      bodyHtml: paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`).join("") + button(url, cta),
      footer: footer(),
    }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\n${cta}: ${url}\n`,
  };
}

export function renderFeeEmail<T extends FeeTemplate>(template: T, data: FeeTemplateData[T]): Rendered {
  if (template === "invoice") {
    const d = data as FeeTemplateData["invoice"];
    return render(
      `New invoice from ${d.payeeName}: ${rands(d.totalCents)}`,
      [`${d.payeeName} has sent invoice ${d.number} for ${d.studentName}: ${rands(d.totalCents)}, due ${d.dueOn}.`, "You can pay it, together with any other open invoices, in one payment."],
      "View and pay",
    );
  }
  if (template === "overdue") {
    const d = data as FeeTemplateData["overdue"];
    return render(
      `${d.days === 7 ? "Reminder" : "Overdue"}: invoice ${d.number} for ${d.studentName}`,
      [`Invoice ${d.number} from ${d.payeeName} for ${d.studentName} (${rands(d.totalCents)}) was due on ${d.dueOn} and is still unpaid.`, "If you've already paid another way, let the tutor know so they can mark it paid."],
      "Pay now",
    );
  }
  const d = data as FeeTemplateData["receipt"];
  return render(
    `Receipt: ${rands(d.totalCents)} paid`,
    [`Thank you. We received ${rands(d.totalCents)} on ${d.paidOn} for ${d.numbers.length === 1 ? `invoice ${d.numbers[0]}` : `invoices ${d.numbers.join(", ")}`}.`, "Each tutor receives their share directly into their bank account."],
    "View payments",
  );
}
