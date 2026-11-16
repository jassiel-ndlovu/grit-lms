/**
 * Pure helpers for scripts/blob-audit.ts. No network, no database, no
 * filesystem: everything here is checked by scripts/check-blob-audit.ts.
 *
 * Design: docs/revamp/a/research/08-blob-cleanup.md, section (c).
 */

/** Any Vercel Blob URL, public or private store. Global flag: use with matchAll. */
export const BLOB_URL_REGEX =
  /https:\/\/[a-z0-9-]+\.(?:[a-z]+\.)?blob\.vercel-storage\.com\/[^\s"'()<>[\]\\`]+/gi;

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/** Characters a sentence or markdown may leave stuck to the end of a URL. */
const TRAILING_JUNK = /[.,;:!?*_~]+$/;

export function isBlobUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && u.hostname.toLowerCase().endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * Comparison key for a blob URL: lower-case host plus the percent-decoded
 * path, with the query string and fragment dropped (`downloadUrl` adds
 * `?download=1`). Returns null for anything that is not a blob URL.
 */
export function normaliseBlobUrl(value: string): string | null {
  let u: URL;
  try {
    u = new URL(value.trim().replace(TRAILING_JUNK, ""));
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || !host.endsWith(BLOB_HOST_SUFFIX)) return null;
  let path = u.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray "%" in a legacy file name: compare on the raw path.
  }
  return `${host}${path.normalize("NFC")}`;
}

/** Host part of a normalised key ("abc.public.blob.vercel-storage.com"). */
export function hostOf(key: string): string {
  const i = key.indexOf("/");
  return i === -1 ? key : key.slice(0, i);
}

/** Every blob URL inside a block of text (markdown, a JSON document, ...), normalised. */
export function extractBlobKeys(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(BLOB_URL_REGEX)) {
    const key = normaliseBlobUrl(m[0]);
    if (key) out.add(key);
  }
  return [...out];
}

/**
 * Blob URLs in a column value cast to text. A text[] value arrives as a
 * Postgres array literal (`{url1,url2}` or `{"url 1",...}`), so braces and
 * the commas between elements are turned into spaces first.
 */
export function extractBlobKeysFromColumn(text: string): string[] {
  return extractBlobKeys(text.replace(/[{}]/g, " ").replace(/,(?=https:)/g, " "));
}

/** Columns that hold blob URLs by design (research 08). Used to label references. */
export const TYPED_URL_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
  ["Course", "imageUrl"],
  ["Tutor", "profileImageUrl"],
  ["Student", "imageUrl"],
  ["Attachment", "url"],
  ["Lesson", "videoUrl"],
  ["Submission", "descriptionFiles"],
  ["Submission", "memoFileUrls"],
  ["SubmissionEntry", "fileUrl"],
  ["Test", "memoFileUrls"],
  ["UploadedFile", "fileUrl"],
  ["Resource", "url"],
  ["CourseEvent", "link"],
];

export type BlobRow = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
};

export type Status = "REFERENCED" | "TOO_NEW" | "ORPHAN_CANDIDATE";
export type Band = "A_SAFE" | "B_PROBABLY_SAFE" | "C_REVIEW";

/** References: normalised key -> set of "db:Table.column" labels. */
export type RefMap = Map<string, Set<string>>;

export function addRef(refs: RefMap, key: string, label: string): void {
  let s = refs.get(key);
  if (!s) refs.set(key, (s = new Set()));
  s.add(label);
}

/**
 * Pathname with IDs replaced by `*`, so the summary can group by upload kind
 * without printing IDs or file names. Mirrors src/lib/blob/paths.ts.
 */
export function prefixPattern(pathname: string): string {
  const p = pathname.replace(/^\/+/, "");
  const s = p.split("/");
  if (s.length === 1) return "(store root, legacy upload)";
  if (s[0] === "courses" && s[2] === "cover") return "courses/*/cover/";
  if (s[0] === "courses" && s[2] === "lessons" && s[4] === "attachments")
    return "courses/*/lessons/*/attachments/";
  if (s[0] === "courses" && s[2] === "lessons" && s[4] === "uploaded")
    return "courses/*/lessons/*/uploaded/";
  if (s[0] === "submissions") return "submissions/*/";
  if (s[0] === "tests" && s[1] === "memo") return "tests/memo/questions/*/";
  if (s[0] === "tests" && s[2] === "questions" && s[3] === "memo") return "tests/*/questions/memo/";
  if (s[0] === "tests" && s[2] === "questions") return "tests/*/questions/*/";
  if (s[0] === "tests" && s[2] === "answers") return "tests/*/answers/*/";
  if (s[0] === "users" && s[2] === "avatar") return "users/*/avatar/";
  return `${s[0]}/… (unknown scheme)`;
}

/** Deletion band from research 08 section (d). Only meaningful for orphans. */
export function bandFor(pathname: string): Band {
  const pattern = prefixPattern(pathname);
  if (
    pattern === "courses/*/cover/" ||
    pattern === "courses/*/lessons/*/attachments/" ||
    pattern === "submissions/*/"
  )
    return "A_SAFE";
  if (pattern.startsWith("tests/") || pattern.startsWith("users/")) return "B_PROBABLY_SAFE";
  return "C_REVIEW";
}

export type Classified = BlobRow & {
  key: string;
  status: Status;
  band: Band | "";
  referencedBy: string[];
};

export type AuditResult = {
  blobs: Classified[];
  /** Referenced in a database but missing from this store. */
  broken: { key: string; referencedBy: string[] }[];
  /** Referenced URLs that point at a different Blob store. */
  otherStores: Map<string, number>;
  storeHosts: string[];
};

export function classify(blobs: BlobRow[], refs: RefMap, now: Date, graceDays: number): AuditResult {
  const cutoff = now.getTime() - graceDays * 86_400_000;
  const listed = new Set<string>();
  const storeHosts = new Set<string>();
  const out: Classified[] = [];

  for (const b of blobs) {
    const key = normaliseBlobUrl(b.url);
    if (!key) throw new Error(`Listed blob has an unexpected URL shape: ${b.pathname}`);
    listed.add(key);
    storeHosts.add(hostOf(key));
    const by = refs.get(key);
    let status: Status;
    if (by && by.size > 0) status = "REFERENCED";
    else if (b.uploadedAt.getTime() > cutoff) status = "TOO_NEW";
    else status = "ORPHAN_CANDIDATE";
    out.push({
      ...b,
      key,
      status,
      band: status === "ORPHAN_CANDIDATE" ? bandFor(b.pathname) : "",
      referencedBy: by ? [...by].sort() : [],
    });
  }

  const broken: AuditResult["broken"] = [];
  const otherStores = new Map<string, number>();
  for (const [key, by] of refs) {
    if (listed.has(key)) continue;
    const host = hostOf(key);
    if (storeHosts.size > 0 && !storeHosts.has(host)) {
      otherStores.set(host, (otherStores.get(host) ?? 0) + 1);
    } else {
      broken.push({ key, referencedBy: [...by].sort() });
    }
  }

  return { blobs: out, broken, otherStores, storeHosts: [...storeHosts] };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function blobsCsv(r: AuditResult): string {
  return toCsv([
    ["pathname", "size_bytes", "uploaded_at", "status", "band", "prefix", "referenced_by"],
    ...r.blobs.map((b) => [
      b.pathname,
      b.size,
      b.uploadedAt.toISOString(),
      b.status,
      b.band,
      prefixPattern(b.pathname),
      b.referencedBy.join(" "),
    ]),
  ]);
}

export function mb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}

type Tally = { count: number; bytes: number };
function tally<K>(items: Iterable<[K, number]>): Map<K, Tally> {
  const m = new Map<K, Tally>();
  for (const [k, bytes] of items) {
    const t = m.get(k) ?? { count: 0, bytes: 0 };
    t.count++;
    t.bytes += bytes;
    m.set(k, t);
  }
  return m;
}

export type SummaryMeta = {
  generatedAt: Date;
  mode: "live" | "dry-run";
  graceDays: number;
  listCalls: number;
  databases: string[];
  columnsScanned: number;
  missingTypedColumns: string[];
};

/** Counts and MB only: no pathnames, IDs, file names or row contents. Safe to share. */
export function summaryMarkdown(r: AuditResult, meta: SummaryMeta): string {
  const total = r.blobs.reduce((s, b) => s + b.size, 0);
  const byStatus = tally(r.blobs.map((b) => [b.status, b.size] as [Status, number]));
  const orphans = r.blobs.filter((b) => b.status === "ORPHAN_CANDIDATE");
  const byBand = tally(orphans.map((b) => [b.band as Band, b.size] as [Band, number]));
  const byPrefix = tally(r.blobs.map((b) => [`${prefixPattern(b.pathname)}|${b.status}`, b.size] as [string, number]));

  const line = (label: string, t?: Tally) =>
    `| ${label} | ${t?.count ?? 0} | ${mb(t?.bytes ?? 0)} |`;

  const prefixes = [...new Set(r.blobs.map((b) => prefixPattern(b.pathname)))].sort();
  const statuses: Status[] = ["REFERENCED", "TOO_NEW", "ORPHAN_CANDIDATE"];

  const out = [
    `# Blob audit summary${meta.mode === "dry-run" ? " (DRY RUN, fake data)" : ""}`,
    "",
    `Generated ${meta.generatedAt.toISOString()}. Read-only: nothing was deleted.`,
    "",
    `- Store host(s): ${r.storeHosts.length} (${r.storeHosts.map((h) => h.split(".")[0]).join(", ") || "none"})`,
    `- Blobs listed: ${r.blobs.length}, ${mb(total)} MB`,
    `- list() calls used: ${meta.listCalls} (advanced operations; Hobby allows 2,000 a month)`,
    `- Databases scanned: ${meta.databases.join(", ")}`,
    `- Text, text[] and json(b) columns scanned: ${meta.columnsScanned}`,
    `- Grace period: ${meta.graceDays} days (newer files are never candidates)`,
    meta.missingTypedColumns.length
      ? `- Typed URL columns not found (schema drift, check research 08): ${meta.missingTypedColumns.join(", ")}`
      : "- All 12 typed URL columns were found",
    "",
    "## By status",
    "",
    "| Status | Files | MB |",
    "| --- | ---: | ---: |",
    ...statuses.map((s) => line(s, byStatus.get(s))),
    "",
    "## Orphan candidates by band",
    "",
    "Band A is safe to approve first; band C needs a look by hand (research 08, section d).",
    "",
    "| Band | Files | MB |",
    "| --- | ---: | ---: |",
    line("A_SAFE", byBand.get("A_SAFE")),
    line("B_PROBABLY_SAFE", byBand.get("B_PROBABLY_SAFE")),
    line("C_REVIEW", byBand.get("C_REVIEW")),
    line("**All candidates**", { count: orphans.length, bytes: orphans.reduce((s, b) => s + b.size, 0) }),
    "",
    "## By upload kind",
    "",
    "| Prefix | Referenced (files / MB) | Too new | Orphan candidates |",
    "| --- | ---: | ---: | ---: |",
    ...prefixes.map((p) => {
      const cell = (s: Status) => {
        const t = byPrefix.get(`${p}|${s}`);
        return t ? `${t.count} / ${mb(t.bytes)}` : "0";
      };
      return `| ${p} | ${cell("REFERENCED")} | ${cell("TOO_NEW")} | ${cell("ORPHAN_CANDIDATE")} |`;
    }),
    "",
    "## Other findings",
    "",
    `- Broken references (a database row points at a file missing from this store): ${r.broken.length}. These are a bug list, not cleanup.`,
    `- References to a different Blob store: ${[...r.otherStores.values()].reduce((a, b) => a + b, 0)} across ${r.otherStores.size} other host(s).`,
    "",
    "Files next to this summary (`blobs.csv`, `orphans.json`, `broken-references.csv`) hold pathnames with user IDs and original file names. Keep them on this machine. Share this summary only.",
    "",
  ];
  return out.join("\n");
}
