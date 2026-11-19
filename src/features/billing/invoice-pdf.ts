/**
 * Invoice PDF for a platform invoice (contract section 1, `pdfUrl`).
 * Rendered on request from the stored invoice, so it always matches the
 * lines; nothing is stored. Pure apart from pdf-lib: scripts/check-invoice-pdf.ts
 * renders it.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type InvoicePdfData = {
  number: string;
  status: string;
  issuedAt: Date;
  dueAt: Date;
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  billTo: { name: string; legalName: string | null; vatNumber: string | null; email: string | null };
  lines: Array<{ description: string; quantity: number; unitPriceCents: number; amountCents: number }>;
  subtotalCents: number;
  discountCents: number;
  creditCents: number;
  vatCents: number;
  vatRateBps: number | null;
  totalCents: number;
  timeZone: string;
};

const SLATE = rgb(0.106, 0.165, 0.255);
const TAUPE = rgb(0.42, 0.357, 0.227);
const TERRACOTTA = rgb(0.757, 0.431, 0.282);

/** R1,234.50, with a minus sign for credits. */
export function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const [r, c] = (Math.abs(cents) / 100).toFixed(2).split(".");
  return `${sign}R${r.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${c}`;
}

function day(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
}

/** The standard fonts only cover WinAnsi; anything else becomes "?". */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ]/g, "?");
}

/** Cuts text to fit `width`, adding an ellipsis. */
function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

export async function renderInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${d.number}`);
  pdf.setAuthor("Nexa LMS");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28; // A4
  const H = 841.89;
  const M = 50;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size = 10, font = regular, color = SLATE) => page.drawText(safe(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, size = 10, font = regular, color = SLATE) =>
    page.drawText(safe(s), { x: xRight - font.widthOfTextAtSize(safe(s), size), y, size, font, color });

  // Header
  text("Nexa LMS", M, 20, bold);
  right(d.vatCents > 0 ? "TAX INVOICE" : "INVOICE", W - M, 14, bold, TERRACOTTA);
  y -= 16;
  text("nexa-lms.co.za  ·  support@nexa-lms.co.za", M, 9, regular, TAUPE);
  y -= 30;

  // Invoice facts and bill-to
  const facts: Array<[string, string]> = [
    ["Invoice", d.number],
    ["Issued", day(d.issuedAt, d.timeZone)],
    ["Due", day(d.dueAt, d.timeZone)],
    ["Period", `${day(d.periodStart, d.timeZone)} to ${day(new Date(d.periodEnd.getTime() - 1), d.timeZone)}`],
    ["Status", d.paidAt ? `Paid ${day(d.paidAt, d.timeZone)}` : d.status === "VOID" ? "Void" : "Unpaid"],
  ];
  const top = y;
  for (const [k, v] of facts) {
    text(k, M, 9, bold, TAUPE);
    text(v, M + 60, 10);
    y -= 15;
  }
  y = top;
  const billX = W / 2 + 20;
  text("Bill to", billX, 9, bold, TAUPE);
  y -= 15;
  for (const l of [d.billTo.legalName || d.billTo.name, d.billTo.legalName ? d.billTo.name : null, d.billTo.vatNumber ? `VAT ${d.billTo.vatNumber}` : null, d.billTo.email]) {
    if (!l) continue;
    text(fit(l, regular, 10, W - M - billX), billX, 10);
    y -= 15;
  }
  y = Math.min(y, top - facts.length * 15) - 20;

  // Lines
  const cols = { desc: M, qty: W - M - 190, unit: W - M - 95, amount: W - M };
  const header = () => {
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.5, color: TAUPE });
    text("Description", cols.desc, 9, bold, TAUPE);
    right("Qty", cols.qty, 9, bold, TAUPE);
    right("Unit", cols.unit, 9, bold, TAUPE);
    right("Amount", cols.amount, 9, bold, TAUPE);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: TAUPE });
    y -= 14;
  };
  header();
  for (const l of d.lines) {
    if (y < M + 120) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    text(fit(l.description, regular, 10, cols.qty - cols.desc - 50), cols.desc, 10);
    right(String(l.quantity), cols.qty, 10);
    right(money(l.unitPriceCents), cols.unit, 10);
    right(money(l.amountCents), cols.amount, 10);
    y -= 16;
  }
  y -= 4;
  page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.5, color: TAUPE });

  // Totals
  const totals: Array<[string, number, boolean]> = [["Subtotal", d.subtotalCents, false]];
  if (d.discountCents) totals.push(["Discount", -d.discountCents, false]);
  if (d.creditCents) totals.push(["Credit", -d.creditCents, false]);
  if (d.vatCents) totals.push([`VAT${d.vatRateBps ? ` ${d.vatRateBps / 100}%` : ""}`, d.vatCents, false]);
  totals.push(["Total", d.totalCents, true]);
  for (const [k, v, strong] of totals) {
    y -= 4;
    right(k, cols.unit, strong ? 11 : 10, strong ? bold : regular);
    right(money(v), cols.amount, strong ? 11 : 10, strong ? bold : regular);
    y -= 14;
  }

  y = M;
  text(d.vatCents > 0 ? "Amounts in South African rand." : "Amounts in South African rand. Nexa is not registered for VAT; no VAT is charged.", M, 8, regular, TAUPE);
  return pdf.save();
}
