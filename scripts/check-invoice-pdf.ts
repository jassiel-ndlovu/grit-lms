/**
 * Renders invoice PDFs from fixed data and checks the output: a valid PDF,
 * one page for a short invoice, more for a long one, and money formatting.
 * Writes the sample to the scratch path given as the first argument, if any.
 *
 *   npx tsx scripts/check-invoice-pdf.ts [out.pdf]
 */

import { writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";

import { money, renderInvoicePdf, type InvoicePdfData } from "../src/features/billing/invoice-pdf";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const base: InvoicePdfData = {
  number: "NX-2027-000123", status: "PAID",
  issuedAt: new Date("2027-03-05T08:00:00Z"), dueAt: new Date("2027-03-05T08:00:00Z"), paidAt: new Date("2027-03-05T08:01:00Z"),
  periodStart: new Date("2027-03-05T08:01:00Z"), periodEnd: new Date("2027-04-04T08:01:00Z"),
  billTo: { name: "Maths with Thandi", legalName: "Thandi Tutoring (Pty) Ltd", vatNumber: "4123456789", email: "billing@example.com" },
  lines: [
    { description: "Grade 11 Maths, Pro", quantity: 12, unitPriceCents: 17900, amountCents: 214800 },
    { description: "Grade 12 Maths, Plus", quantity: 13, unitPriceCents: 13900, amountCents: 180700 },
    { description: "Grade 12, 1 student added during the period", quantity: 1, unitPriceCents: 13900, amountCents: 13900 },
    { description: "Grade 11, Plus to Pro", quantity: 12, unitPriceCents: 4000, amountCents: 48000 },
  ],
  subtotalCents: 457400, discountCents: 0, creditCents: 0, vatCents: 0, vatRateBps: null, totalCents: 457400,
  timeZone: "Africa/Johannesburg",
};

async function main() {
  check("money", [money(457400), money(-66720), money(0)], ["R4,574.00", "-R667.20", "R0.00"]);

  const bytes = await renderInvoicePdf(base);
  check("starts with %PDF", Buffer.from(bytes.slice(0, 4)).toString(), "%PDF");
  const doc = await PDFDocument.load(bytes);
  check("short invoice is one page", doc.getPageCount(), 1);
  check("title carries the number", doc.getTitle(), "Invoice NX-2027-000123");

  const long = await renderInvoicePdf({ ...base, lines: Array.from({ length: 80 }, (_, i) => ({ description: `Course ${i + 1}, Core`, quantity: 3, unitPriceCents: 9900, amountCents: 29700 })) });
  check("80 lines flow onto more pages", (await PDFDocument.load(long)).getPageCount() > 1, true);

  const odd = await renderInvoicePdf({ ...base, billTo: { ...base.billTo, name: "Ṱhandi's ✓ class" }, lines: [{ description: "Émile — 数学 a very long course name that goes on and on and on and on and on and on and on", quantity: 1, unitPriceCents: 9900, amountCents: 9900 }] });
  check("characters outside the font don't break rendering", Buffer.from(odd.slice(0, 4)).toString(), "%PDF");

  const vat = await renderInvoicePdf({ ...base, vatCents: 68610, vatRateBps: 1500, totalCents: 526010 });
  check("VAT invoice renders", Buffer.from(vat.slice(0, 4)).toString(), "%PDF");

  if (process.argv[2]) writeFileSync(process.argv[2], bytes);
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
