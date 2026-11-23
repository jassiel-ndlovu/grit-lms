/**
 * Renders term report PDFs from fixed data and checks the output: a valid
 * PDF, one page for a short report, more for a long one, wrapping, safe
 * text and file names. Writes the samples next to the path given as the
 * first argument, if any.
 *
 *   npx tsx scripts/check-term-report-pdf.ts [out.pdf]
 */

import { writeFileSync } from "node:fs";

import { PDFDocument, StandardFonts } from "pdf-lib";

import { renderTermReportPdf, safe, termReportFileName, wrap, type TermReportPdfData } from "../src/features/reports/term-report-pdf";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const short: TermReportPdfData = {
  workspace: { name: "Ubuntu Tutors", contact: "ubuntu.example  ·  info@ubuntu.example" },
  term: { title: "Term 3 2026", from: new Date("2026-07-14T00:00:00Z"), to: new Date("2026-09-23T00:00:00Z") },
  student: { name: "Thandi Mokoena", grade: "10" },
  courses: [
    {
      name: "Mathematics Grade 10", tutor: "Ayanda Zulu", percent: 72.5, symbol: "Level 6",
      items: [
        { title: "Algebra test", kind: "test", score: 38, outOf: 50 },
        { title: "Functions assignment", kind: "assignment", score: 17, outOf: 25 },
        { title: "Trigonometry quiz", kind: "test", score: null, outOf: 20 },
      ],
      attendance: { present: 18, late: 2, absent: 1, excused: 0 },
      comment: "Thandi works steadily and asks good questions. Practise factorising before the exam; her functions work is already strong.",
    },
    {
      name: "Physical Sciences Grade 10", tutor: "Bongi Nkosi", percent: null, items: [], attendance: null,
      comment: null,
    },
  ],
  overall: { comment: "A good term. Keep up the steady effort.", by: "Lerato Dlamini, Principal" },
  generatedAt: new Date("2026-09-24T10:00:00Z"),
  timeZone: "Africa/Johannesburg",
};

async function main() {
  const bytes = await renderTermReportPdf(short);
  const doc = await PDFDocument.load(bytes);
  check("a valid PDF", String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
  check("a short report is one page", doc.getPageCount(), 1);
  check("title set", doc.getTitle(), "Term 3 2026 report: Thandi Mokoena");

  const long: TermReportPdfData = {
    ...short,
    courses: Array.from({ length: 9 }, (_, i) => ({
      ...short.courses[0],
      name: `Course ${i + 1}`,
      items: Array.from({ length: 8 }, (_, k) => ({ title: `Assessment ${k + 1} with a fairly long name that wraps onto a second line when the table is narrow`, kind: "test", score: 10 + k, outOf: 20 })),
    })),
  };
  const longBytes = await renderTermReportPdf(long);
  const longDoc = await PDFDocument.load(longBytes);
  check("a long report runs onto more pages", longDoc.getPageCount() > 2, true);

  const odd = await renderTermReportPdf({ ...short, student: { name: "Lwazi Ngcobo ✓ 📘" }, workspace: { name: "Ngcobo — Tutoring", logo: new Uint8Array([1, 2, 3]) } });
  check("unsupported characters and a broken logo don't stop it", (await PDFDocument.load(odd)).getPageCount(), 1);

  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const lines = wrap("one two three four five six seven eight nine ten eleven twelve", font, 10, 80);
  check("wrapping keeps every word and stays narrow", [lines.join(" "), lines.every((l) => font.widthOfTextAtSize(l, 10) <= 80)], ["one two three four five six seven eight nine ten eleven twelve", true]);
  check("author's line breaks kept", wrap("first\nsecond", font, 10, 400), ["first", "second"]);
  check("safe text", safe("Thandi ✓ Mokoena"), "Thandi ? Mokoena");
  check("file name", termReportFileName("Thandi Mokoena", "Term 3 2026"), "thandi-mokoena-term-3-2026.pdf");

  const out = process.argv[2];
  if (out) {
    writeFileSync(out, bytes);
    writeFileSync(out.replace(/\.pdf$/, "-long.pdf"), longBytes);
    console.log(`wrote ${out}`);
  }
  if (failures) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll term report checks passed.");
}

main();
