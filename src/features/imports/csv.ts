/**
 * CSV for imports and exports (#216). Pure, so check scripts and the client
 * can use it.
 *
 * Reading: RFC 4180 quoting ("a, b", "say ""hi"""), line breaks inside
 * quotes, a byte-order mark, and the delimiter guessed from the header row:
 * comma, semicolon (Excel in South African locales often saves with ";") or
 * tab. Writing: always comma-separated with a byte-order mark so Excel reads
 * UTF-8, and cells that start like a formula are prefixed with ' so a
 * spreadsheet never runs them.
 */

export type CsvTable = { headers: string[]; rows: string[][]; delimiter: "," | ";" | "\t" };

export const CSV_LIMITS = { maxBytes: 1_000_000, maxRows: 2_000 } as const;

function guessDelimiter(firstLine: string): CsvTable["delimiter"] {
  const counts: Record<CsvTable["delimiter"], number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as CsvTable["delimiter"]]++;
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

/** Parses CSV text. Blank lines are skipped; short rows are padded to the header's width. */
export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = guessDelimiter(firstLine);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      records.push(record); record = [];
    } else field += ch;
  }
  if (field !== "" || record.length) { record.push(field); records.push(record); }
  const nonBlank = records.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonBlank.shift() ?? []).map((h) => h.trim());
  const rows = nonBlank.map((r) => headers.map((_, j) => (r[j] ?? "").trim()));
  return { headers, rows, delimiter };
}

/** "Full name", "full_name" and "FULL-NAME" all become "full name". */
export function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Maps the file's headers onto an importer's fields. `aliases` lists the
 * accepted header names per field (already normalised). Returns, per field,
 * the column index or -1, plus headers nobody claimed.
 */
export function mapHeaders<F extends string>(headers: string[], aliases: Record<F, readonly string[]>): { columns: Record<F, number>; unknown: string[] } {
  const norm = headers.map(normaliseHeader);
  const columns = {} as Record<F, number>;
  const used = new Set<number>();
  for (const field of Object.keys(aliases) as F[]) {
    const i = norm.findIndex((h, j) => !used.has(j) && aliases[field].includes(h));
    columns[field] = i;
    if (i >= 0) used.add(i);
  }
  return { columns, unknown: headers.filter((_, j) => !used.has(j) && headers[j] !== "") };
}

/** A cell made safe for spreadsheets: values starting with = + - @ or a tab get a leading '. */
export function safeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** CSV text with a byte-order mark, comma-separated, quoted where needed. */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const q = (v: unknown) => {
    const s = safeCell(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

/** "yes", "y", "true", "1", "x" → true; "no", "n", "false", "0" → false; anything else → null. */
export function parseYesNo(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (["yes", "y", "true", "1", "x", "ja"].includes(s)) return true;
  if (["no", "n", "false", "0", "nee"].includes(s)) return false;
  return null;
}

/** Splits a list cell on ; or | (commas are often inside course names). */
export function splitList(v: string): string[] {
  return v.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
}
