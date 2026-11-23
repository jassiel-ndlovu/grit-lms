/**
 * Term report PDFs (Core; #216 phase 1, B's request). B gathers the marks,
 * attendance and comments; this turns them into an A4 report. Rendered on
 * request, nothing stored, like invoices. Pure apart from pdf-lib:
 * scripts/check-term-report-pdf.ts renders samples. Contract: viewer.md,
 * "Term report PDFs".
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type TermReportPdfData = {
  workspace: { name: string; /** A PNG or JPEG logo's bytes, if any. */ logo?: Uint8Array | null; contact?: string | null };
  term: { title: string; from: Date; to: Date };
  student: { name: string; grade?: string | null; username?: string | null };
  courses: Array<{
    name: string;
    tutor?: string | null;
    /** The course mark as a percentage, or null when there's nothing marked yet. */
    percent: number | null;
    /** Optional symbol or level ("A", "Level 7"), as the workspace uses. */
    symbol?: string | null;
    items: Array<{ title: string; kind?: string | null; score: number | null; outOf: number; weight?: number | null }>;
    attendance?: { present: number; late: number; absent: number; excused: number } | null;
    comment?: string | null;
  }>;
  /** A general comment (class teacher, owner or principal), with who wrote it. */
  overall?: { comment?: string | null; by?: string | null } | null;
  generatedAt: Date;
  timeZone: string;
};

const SLATE = rgb(0.106, 0.165, 0.255);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.86, 0.88);
const ACCENT = rgb(0.757, 0.431, 0.282);
const W = 595.28; // A4
const H = 841.89;
const M = 48;

function day(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
}

/** The standard fonts only cover WinAnsi; anything else becomes "?". */
export function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ]/g, "?");
}

/** Splits text into lines no wider than `width`, keeping the author's line breaks. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  // Split first: safe() would turn the line breaks into "?".
  for (const para of text.split(/\r?\n/).map(safe)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // A single word longer than the line is cut.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export async function renderTermReportPdf(d: TermReportPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.term.title} report: ${safe(d.student.name)}`);
  pdf.setAuthor(safe(d.workspace.name));
  pdf.setCreator("Nexa LMS");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  if (d.workspace.logo?.length) {
    try {
      logo = d.workspace.logo[0] === 0x89 ? await pdf.embedPng(d.workspace.logo) : await pdf.embedJpg(d.workspace.logo);
    } catch {
      logo = null; // a broken logo never stops the report
    }
  }

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];
  const text = (s: string, x: number, size = 10, font = regular, color = SLATE) => page.drawText(safe(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, size = 10, font = regular, color = SLATE) =>
    page.drawText(safe(s), { x: xRight - font.widthOfTextAtSize(safe(s), size), y, size, font, color });
  const rule = (color = LINE) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color });
  /** Starts a new page when fewer than `need` points are left. */
  const room = (need: number) => {
    if (y - need >= M + 24) return;
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - M;
    text(`${d.student.name}, ${d.term.title} (continued)`, M, 9, regular, MUTED);
    y -= 22;
  };

  // Header.
  let x = M;
  if (logo) {
    const h = 36;
    const w = Math.min(120, (logo.width / logo.height) * h);
    page.drawImage(logo, { x: M, y: y - h + 10, width: w, height: h });
    x = M + w + 12;
  }
  text(d.workspace.name, x, 16, bold);
  right("TERM REPORT", W - M, 12, bold, ACCENT);
  y -= 16;
  if (d.workspace.contact) text(d.workspace.contact, x, 9, regular, MUTED);
  right(d.term.title, W - M, 10, regular, MUTED);
  y -= 30;

  // Student.
  text(d.student.name, M, 14, bold);
  y -= 15;
  const facts = [d.student.grade ? `Grade ${d.student.grade}` : null, `${day(d.term.from, d.timeZone)} to ${day(d.term.to, d.timeZone)}`].filter(Boolean).join("  ·  ");
  text(facts, M, 9, regular, MUTED);
  y -= 18;

  // Summary across courses.
  const marked = d.courses.filter((c) => c.percent !== null);
  const average = marked.length ? marked.reduce((n, c) => n + (c.percent ?? 0), 0) / marked.length : null;
  const att = d.courses.reduce((a, c) => ({
    present: a.present + (c.attendance?.present ?? 0), late: a.late + (c.attendance?.late ?? 0),
    absent: a.absent + (c.attendance?.absent ?? 0), excused: a.excused + (c.attendance?.excused ?? 0),
  }), { present: 0, late: 0, absent: 0, excused: 0 });
  const sessions = att.present + att.late + att.absent + att.excused;
  rule();
  y -= 16;
  text(`Courses: ${d.courses.length}`, M, 10);
  text(`Average: ${average === null ? "not marked yet" : `${fmt(average)}%`}`, M + 130, 10);
  if (sessions) text(`Attendance: ${att.present + att.late} of ${sessions} classes${att.late ? ` (${att.late} late)` : ""}`, M + 290, 10);
  y -= 12;
  rule();
  y -= 22;

  // One block per course.
  const colScore = W - M - 120;
  const colPct = W - M;
  for (const c of d.courses) {
    room(70);
    text(c.name, M, 12, bold);
    right(c.percent === null ? "Not marked yet" : `${fmt(c.percent)}%${c.symbol ? `  ${c.symbol}` : ""}`, colPct, 12, bold, c.percent === null ? MUTED : SLATE);
    y -= 14;
    if (c.tutor) { text(`Tutor: ${c.tutor}`, M, 9, regular, MUTED); y -= 14; }
    if (c.items.length) {
      y -= 2;
      text("Assessment", M, 8, bold, MUTED);
      right("Mark", colScore + 60, 8, bold, MUTED);
      right("%", colPct, 8, bold, MUTED);
      y -= 12;
      for (const it of c.items) {
        room(14);
        const title = it.kind ? `${it.title} (${it.kind})` : it.title;
        const lines = wrap(title, regular, 9, colScore - M - 20);
        text(lines[0], M, 9);
        right(it.score === null ? "-" : `${fmt(it.score)} / ${fmt(it.outOf)}`, colScore + 60, 9);
        right(it.score === null || it.outOf <= 0 ? "" : `${fmt((it.score / it.outOf) * 100)}%`, colPct, 9);
        y -= 12;
        for (const more of lines.slice(1)) { room(12); text(more, M, 9); y -= 12; }
      }
    }
    if (c.attendance && c.attendance.present + c.attendance.late + c.attendance.absent + c.attendance.excused > 0) {
      room(14);
      const a = c.attendance;
      text(`Attendance: ${a.present} present${a.late ? `, ${a.late} late` : ""}${a.absent ? `, ${a.absent} absent` : ""}${a.excused ? `, ${a.excused} excused` : ""}`, M, 9, regular, MUTED);
      y -= 13;
    }
    if (c.comment?.trim()) {
      y -= 2;
      for (const line of wrap(c.comment.trim(), italic, 9.5, W - 2 * M)) { room(13); text(line, M, 9.5, italic); y -= 13; }
    }
    y -= 8;
    rule();
    y -= 18;
  }

  // Overall comment and signature.
  if (d.overall?.comment?.trim()) {
    room(60);
    text("General comment", M, 11, bold);
    y -= 15;
    for (const line of wrap(d.overall.comment.trim(), regular, 10, W - 2 * M)) { room(14); text(line, M, 10); y -= 14; }
    if (d.overall.by) { y -= 4; text(d.overall.by, M, 9, regular, MUTED); y -= 14; }
    y -= 10;
  }
  room(40);
  y -= 16;
  page.drawLine({ start: { x: M, y }, end: { x: M + 180, y }, thickness: 0.6, color: MUTED });
  page.drawLine({ start: { x: W - M - 180, y }, end: { x: W - M, y }, thickness: 0.6, color: MUTED });
  y -= 12;
  text("Parent or guardian", M, 8, regular, MUTED);
  right("Date", W - M, 8, regular, MUTED);

  // Footers.
  pages.forEach((p, i) => {
    const f = `Made with Nexa LMS on ${day(d.generatedAt, d.timeZone)}  ·  Page ${i + 1} of ${pages.length}`;
    p.drawText(f, { x: W / 2 - regular.widthOfTextAtSize(f, 8) / 2, y: M - 20, size: 8, font: regular, color: MUTED });
  });
  return pdf.save();
}

/** "thandi-mokoena-term-3-2026.pdf" */
export function termReportFileName(studentName: string, termTitle: string): string {
  const slug = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return `${slug(studentName) || "student"}-${slug(termTitle) || "term"}.pdf`;
}

/** The response for a download: B's route returns this. */
export function pdfResponse(bytes: Uint8Array, fileName: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
