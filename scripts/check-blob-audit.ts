/**
 * Check for scripts/lib/blob-audit-core.ts. No network, no database.
 * Run: npx tsx scripts/check-blob-audit.ts
 */
import {
  addRef,
  bandFor,
  classify,
  extractBlobKeys,
  extractBlobKeysFromColumn,
  isBlobUrl,
  normaliseBlobUrl,
  prefixPattern,
  summaryMarkdown,
  type RefMap,
} from "./lib/blob-audit-core";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok && detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
}

const H = "abc123.public.blob.vercel-storage.com";
const url = (p: string) => `https://${H}/${p}`;

// normalise
check("drops ?download=1", normaliseBlobUrl(url("a/b.pdf?download=1")) === `${H}/a/b.pdf`);
check("decodes %20", normaliseBlobUrl(url("My%20File.pdf")) === `${H}/My File.pdf`);
check("lower-cases the host", normaliseBlobUrl(`https://ABC123.PUBLIC.blob.vercel-storage.com/X.png`) === `${H}/X.png`);
check("keeps path case", normaliseBlobUrl(url("X.png")) === `${H}/X.png`);
check("bad % escape falls back to raw path", normaliseBlobUrl(url("100%.pdf")) === `${H}/100%.pdf`);
check("YouTube is not a blob", normaliseBlobUrl("https://www.youtube.com/watch?v=x") === null && !isBlobUrl("https://youtu.be/x"));
check("http is not accepted", normaliseBlobUrl(`http://${H}/a.png`) === null);
check("lookalike host rejected", normaliseBlobUrl("https://blob.vercel-storage.com.evil.test/a.png") === null);

// extraction
const md = `See ![graph](${url("tests/t/questions/q/g.png")}) and [memo](${url("tests/t/questions/memo/m.pdf")}).`;
check("markdown image and link", extractBlobKeys(md).length === 2, extractBlobKeys(md));
check("trailing full stop stripped", extractBlobKeys(`Open ${url("a.pdf")}.`)[0] === `${H}/a.pdf`);
const json = JSON.stringify({ q1: { fileUrl: url("tests/t/answers/q1/p.jpg") }, q2: "text" });
check("JSON answer", extractBlobKeys(json)[0] === `${H}/tests/t/answers/q1/p.jpg`, extractBlobKeys(json));
const nested = JSON.stringify(JSON.stringify({ memoFileUrl: url("submissions/s/memo-1-a.pdf") }));
check("JSON inside a JSON string (QuestionGrade.feedback)", extractBlobKeys(nested)[0] === `${H}/submissions/s/memo-1-a.pdf`, extractBlobKeys(nested));
const arr = `{${url("a.pdf")},${url("b.pdf")},"${url("My%20c.pdf")}"}`;
check("text[] array literal", JSON.stringify(extractBlobKeysFromColumn(arr)) === JSON.stringify([`${H}/a.pdf`, `${H}/b.pdf`, `${H}/My c.pdf`]), extractBlobKeysFromColumn(arr));
check("duplicates collapse", extractBlobKeys(`${url("a.pdf")} ${url("a.pdf?download=1")}`).length === 1);
check("private store host matches", extractBlobKeys("https://abc.private.blob.vercel-storage.com/x.pdf").length === 1);
check("regex is reusable (global flag state)", extractBlobKeys(md).length === 2);

// prefixes and bands
check("cover prefix", prefixPattern("courses/c1/cover/a.png") === "courses/*/cover/");
check("attachment prefix", prefixPattern("courses/c/lessons/l/attachments/a.pdf") === "courses/*/lessons/*/attachments/");
check("root legacy file", prefixPattern("My Homework.docx") === "(store root, legacy upload)");
check("test memo", prefixPattern("tests/t/questions/memo/m.pdf") === "tests/*/questions/memo/");
check("model answer", prefixPattern("tests/memo/questions/k/a.pdf") === "tests/memo/questions/*/");
check("band A for submissions", bandFor("submissions/s/a.pdf") === "A_SAFE");
check("band B for tests/draft", bandFor("tests/draft/questions/q/a.png") === "B_PROBABLY_SAFE");
check("band C for root and unknown", bandFor("x.pdf") === "C_REVIEW" && bandFor("weird/x.pdf") === "C_REVIEW");

// classification
const now = new Date("2026-11-16T00:00:00Z");
const old = new Date("2026-08-01T00:00:00Z");
const fresh = new Date("2026-11-10T00:00:00Z");
const blobs = [
  { url: url("courses/c/cover/a.png"), pathname: "courses/c/cover/a.png", size: 100, uploadedAt: old },
  { url: url("courses/c/cover/b.png"), pathname: "courses/c/cover/b.png", size: 200, uploadedAt: old },
  { url: url("tests/t/answers/q/n.jpg"), pathname: "tests/t/answers/q/n.jpg", size: 300, uploadedAt: fresh },
  { url: url("My%20File.pdf"), pathname: "My File.pdf", size: 400, uploadedAt: old },
];
const refs: RefMap = new Map();
addRef(refs, normaliseBlobUrl(url("courses/c/cover/a.png"))!, "main:Course.imageUrl");
addRef(refs, normaliseBlobUrl(url("My%20File.pdf?download=1"))!, "preview:Submission.descriptionFiles");
addRef(refs, normaliseBlobUrl(url("gone.pdf"))!, "main:Attachment.url");
addRef(refs, "other999.public.blob.vercel-storage.com/x.pdf", "main:Resource.url");
const r = classify(blobs, refs, now, 14);
const status = Object.fromEntries(r.blobs.map((b) => [b.pathname, b.status]));
check("referenced cover", status["courses/c/cover/a.png"] === "REFERENCED");
check("unreferenced old cover is a candidate", status["courses/c/cover/b.png"] === "ORPHAN_CANDIDATE");
check("new file kept by grace period", status["tests/t/answers/q/n.jpg"] === "TOO_NEW");
check("reference from an extra database keeps a file", status["My File.pdf"] === "REFERENCED");
check("candidate has a band", r.blobs.find((b) => b.pathname === "courses/c/cover/b.png")?.band === "A_SAFE");
check("broken reference found", r.broken.length === 1 && r.broken[0].key.endsWith("/gone.pdf"), r.broken);
check("other store counted separately", r.otherStores.get("other999.public.blob.vercel-storage.com") === 1);
check("grace 0 makes the new file a candidate", classify(blobs, refs, now, 0).blobs.find((b) => b.pathname.endsWith("n.jpg"))?.status === "ORPHAN_CANDIDATE");

// summary has no pathnames
const summary = summaryMarkdown(r, {
  generatedAt: now, mode: "dry-run", graceDays: 14, listCalls: 1, databases: ["main", "preview"],
  columnsScanned: 10, missingTypedColumns: [],
});
check("summary holds no pathnames or file names", !/cover\/b\.png|My File|n\.jpg/.test(summary));
check("summary totals candidates", summary.includes("| **All candidates** | 1 | 0.0 |"), summary);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
