/**
 * Read-only audit of the Vercel Blob store against the database.
 *
 * Lists every blob (paginated list(), 1 advanced operation per 1,000 files),
 * collects every blob URL the database references (every text, text[] and
 * json/jsonb column in schema "public", scanned with a regex; the 12 typed URL
 * columns from research 08 are checked to exist), and writes a report of
 * unreferenced files with sizes. It NEVER deletes, uploads, copies or reads
 * file contents, and it opens a READ ONLY database transaction.
 *
 * Runbook: docs/revamp/a/ops/blob-audit-runbook.md
 * Design:  docs/revamp/a/research/08-blob-cleanup.md, section (c)
 *
 * Usage:
 *   npx tsx scripts/blob-audit.ts --dry-run            # fake data, no network
 *   npx tsx scripts/blob-audit.ts                      # live: needs the env below
 *
 * Env (read from the shell, or from .env in the repo root; values are never printed):
 *   VERCEL_BLOB_READ_WRITE_TOKEN  store token (the store is connected with prefix VERCEL_BLOB_)
 *   AUDIT_DATABASE_URL            Postgres URL, ideally a Neon branch made from production
 *
 * Flags:
 *   --dry-run                 run the whole pipeline on built-in fake data; no network
 *   --grace-days <n>          files newer than n days are never candidates (default 14)
 *   --extra-db-env <NAME>     also keep blobs referenced by the database whose URL is in
 *                             env var NAME (repeatable: preview, dev, a local database)
 *   --max-list-calls <n>      stop before using more than n list() calls (default 5)
 *   --out <dir>               report folder (default .blob-audit, git-ignored)
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  addRef,
  blobsCsv,
  classify,
  extractBlobKeysFromColumn,
  mb,
  summaryMarkdown,
  toCsv,
  TYPED_URL_COLUMNS,
  type BlobRow,
  type RefMap,
} from "./lib/blob-audit-core";

// ---------------------------------------------------------------- arguments

type Args = {
  dryRun: boolean;
  graceDays: number;
  extraDbEnv: string[];
  maxListCalls: number;
  out: string;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { dryRun: false, graceDays: 14, extraDbEnv: [], maxListCalls: 5, out: ".blob-audit" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--dry-run": a.dryRun = true; break;
      case "--grace-days": a.graceDays = Number(next()); break;
      case "--extra-db-env": a.extraDbEnv.push(next()); break;
      case "--max-list-calls": a.maxListCalls = Number(next()); break;
      case "--out": a.out = next(); break;
      case "-h": case "--help":
        console.log("See the header of scripts/blob-audit.ts and docs/revamp/a/ops/blob-audit-runbook.md");
        process.exit(0);
      default: fail(`Unknown flag ${flag}`);
    }
  }
  if (!Number.isFinite(a.graceDays) || a.graceDays < 0) fail("--grace-days must be 0 or more");
  if (!Number.isInteger(a.maxListCalls) || a.maxListCalls < 1) fail("--max-list-calls must be 1 or more");
  return a;
}

function fail(msg: string): never {
  console.error(`blob-audit: ${msg}`);
  process.exit(1);
}

/** Load .env without overriding the shell. Node 20.12+ has process.loadEnvFile. */
function loadDotEnv(): void {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (loader && existsSync(".env")) loader(".env");
}

/** Show where a URL points without its credentials: host only. */
function describeDb(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}

// ---------------------------------------------------------------- blob store

async function listStore(token: string, maxCalls: number): Promise<{ blobs: BlobRow[]; calls: number }> {
  // Imported here so --dry-run never loads the SDK. Only list() is used.
  const { list } = await import("@vercel/blob");
  const blobs: BlobRow[] = [];
  let cursor: string | undefined;
  let calls = 0;
  do {
    if (calls >= maxCalls) {
      fail(`Stopped after ${calls} list() calls (--max-list-calls). ${blobs.length} blobs so far. Raise the limit if the store really is that big.`);
    }
    const page = await list({ limit: 1000, cursor, token });
    calls++;
    for (const b of page.blobs) {
      blobs.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { blobs, calls };
}

// ---------------------------------------------------------------- database

type Column = { table: string; column: string; dataType: string };

/** The minimum this script needs from a database, inside one read-only transaction. */
type ReadOnlyDb = {
  query<T>(sql: string): Promise<T[]>;
};

const COLUMNS_SQL = `
  SELECT table_name AS "table", column_name AS "column", data_type AS "dataType"
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (data_type IN ('text', 'character varying', 'json', 'jsonb')
         OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar')))
  ORDER BY table_name, column_name`;

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Run fn inside BEGIN ... READ ONLY on a connection, with whichever driver is installed. */
async function withReadOnlyDb<T>(url: string, fn: (db: ReadOnlyDb) => Promise<T>): Promise<T> {
  // Prefer node-postgres if present (it is, once Prisma moves to driver adapters).
  // Module names go through a variable so TypeScript does not require them at build time.
  const pgName = "pg";
  let pg: { Client: new (cfg: { connectionString: string }) => PgClient } | null = null;
  try {
    pg = (await import(pgName)).default;
  } catch {
    pg = null;
  }
  if (pg) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await assertReadOnly({ query: async (sql) => (await client.query(sql)).rows });
      const out = await fn({ query: async (sql) => (await client.query(sql)).rows });
      await client.query("ROLLBACK");
      return out;
    } finally {
      await client.end();
    }
  }

  // Fallback: the app's generated Prisma client (Prisma 5/6 accept datasourceUrl).
  const prismaPath = "../src/generated/prisma";
  let PrismaClient: new (opts: { datasourceUrl: string }) => PrismaLike;
  try {
    PrismaClient = (await import(prismaPath)).PrismaClient;
  } catch {
    fail("No database driver found. Run `npm install` (generates the Prisma client), or install `pg` locally without saving it: `npm i --no-save pg`.");
  }
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const db: ReadOnlyDb = { query: (sql) => tx.$queryRawUnsafe(sql) };
        await assertReadOnly(db);
        return fn(db);
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

type PgClient = {
  connect(): Promise<void>;
  query(sql: string): Promise<{ rows: never[] }>;
  end(): Promise<void>;
};
type PrismaTx = {
  $executeRawUnsafe(sql: string): Promise<number>;
  $queryRawUnsafe<T>(sql: string): Promise<T[]>;
};
type PrismaLike = {
  $transaction<T>(fn: (tx: PrismaTx) => Promise<T>, opts: { timeout: number; maxWait: number }): Promise<T>;
  $disconnect(): Promise<void>;
};

async function assertReadOnly(db: ReadOnlyDb): Promise<void> {
  const rows = await db.query<{ transaction_read_only: string }>("SHOW transaction_read_only");
  if (rows[0]?.transaction_read_only !== "on") fail("Could not open a READ ONLY transaction; stopping.");
}

/** Scan every text-like column for blob URLs. Selects only rows whose value mentions the blob host. */
async function collectRefs(db: ReadOnlyDb, label: string, refs: RefMap): Promise<{ columns: Column[] }> {
  const columns = await db.query<Column>(COLUMNS_SQL);
  for (const c of columns) {
    const col = ident(c.column);
    const sql = `SELECT ${col}::text AS v FROM "public".${ident(c.table)} WHERE ${col}::text LIKE '%blob.vercel-storage.com%'`;
    const rows = await db.query<{ v: string | null }>(sql);
    for (const { v } of rows) {
      if (!v) continue;
      for (const key of extractBlobKeysFromColumn(v)) {
        addRef(refs, key, `${label}:${c.table}.${c.column}`);
      }
    }
  }
  return { columns };
}

function missingTyped(columns: Column[]): string[] {
  const have = new Set(columns.map((c) => `${c.table}.${c.column}`));
  return TYPED_URL_COLUMNS.map(([t, c]) => `${t}.${c}`).filter((k) => !have.has(k));
}

// ---------------------------------------------------------------- dry run

const FAKE_HOST = "fakestore0000.public.blob.vercel-storage.com";
function fakeData(now: Date): { blobs: BlobRow[]; rows: Array<[string, string, string]> } {
  const day = 86_400_000;
  const old = new Date(now.getTime() - 90 * day);
  const recent = new Date(now.getTime() - 2 * day);
  const u = (p: string) => `https://${FAKE_HOST}/${p}`;
  const blobs: BlobRow[] = [
    { url: u("courses/c1/cover/cover-Ab12.png"), pathname: "courses/c1/cover/cover-Ab12.png", size: 120_000, uploadedAt: old },
    { url: u("courses/c1/cover/old-cover-Zz99.png"), pathname: "courses/c1/cover/old-cover-Zz99.png", size: 180_000, uploadedAt: old },
    { url: u("submissions/s1/essay-Qq11.pdf"), pathname: "submissions/s1/essay-Qq11.pdf", size: 2_400_000, uploadedAt: old },
    { url: u("tests/draft/questions/q9/graph-Ww22.png"), pathname: "tests/draft/questions/q9/graph-Ww22.png", size: 60_000, uploadedAt: old },
    { url: u("tests/t1/answers/q2/photo-Ee33.jpg"), pathname: "tests/t1/answers/q2/photo-Ee33.jpg", size: 3_100_000, uploadedAt: old },
    { url: u("My%20Homework-Rr44.docx"), pathname: "My Homework-Rr44.docx", size: 45_000, uploadedAt: old },
    { url: u("Old%20Brief-Tt55.pdf"), pathname: "Old Brief-Tt55.pdf", size: 900_000, uploadedAt: old },
    { url: u("tests/t1/answers/q3/new-Yy66.jpg"), pathname: "tests/t1/answers/q3/new-Yy66.jpg", size: 1_500_000, uploadedAt: recent },
  ];
  const rows: Array<[string, string, string]> = [
    ["Course", "imageUrl", u("courses/c1/cover/cover-Ab12.png")],
    ["SubmissionEntry", "fileUrl", `{${u("submissions/s1/essay-Qq11.pdf")}}`],
    ["TestQuestion", "question", `Look at this graph: ![graph](${u("tests/draft/questions/q9/graph-Ww22.png")}).`],
    ["Submission", "descriptionFiles", `{"${u("My%20Homework-Rr44.docx")}?download=1"}`],
    ["TestSubmission", "answers", `{"q4": {"fileUrl": "${u("tests/t1/answers/q4/missing-Uu77.jpg")}"}}`],
    ["Lesson", "videoUrl", `{https://www.youtube.com/watch?v=abc}`],
    ["Resource", "url", "https://otherstore1111.public.blob.vercel-storage.com/x.pdf"],
  ];
  return { blobs, rows };
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const refs: RefMap = new Map();
  let blobs: BlobRow[];
  let listCalls = 0;
  let columnsScanned = 0;
  let missing: string[] = [];
  const databases: string[] = [];

  if (args.dryRun) {
    console.log("DRY RUN: fake data, no network, no database.");
    const fake = fakeData(now);
    blobs = fake.blobs;
    for (const [t, c, v] of fake.rows) for (const k of extractBlobKeysFromColumn(v)) addRef(refs, k, `fake:${t}.${c}`);
    columnsScanned = new Set(fake.rows.map(([t, c]) => `${t}.${c}`)).size;
    missing = missingTyped(fake.rows.map(([table, column]) => ({ table, column, dataType: "text" })));
    databases.push("fake");
  } else {
    loadDotEnv();
    const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!token) fail("VERCEL_BLOB_READ_WRITE_TOKEN is not set (shell or .env). See the runbook.");
    const mainUrl = process.env.AUDIT_DATABASE_URL;
    if (!mainUrl) fail("AUDIT_DATABASE_URL is not set. Use a Neon branch of production; see the runbook.");
    const dbs: Array<[label: string, url: string]> = [["main", mainUrl]];
    for (const name of args.extraDbEnv) {
      const v = process.env[name];
      if (!v) fail(`--extra-db-env ${name}: that env var is not set`);
      dbs.push([name, v]);
    }

    // Database first: if it fails, no list() operation is spent.
    for (const [label, url] of dbs) {
      console.log(`Scanning database "${label}" at ${describeDb(url)} (read-only transaction)...`);
      const { columns } = await withReadOnlyDb(url, (db) => collectRefs(db, label, refs));
      if (label === "main") {
        columnsScanned = columns.length;
        missing = missingTyped(columns);
      }
      databases.push(label);
    }
    console.log(`Found ${refs.size} distinct blob URLs referenced.`);

    console.log("Listing the Blob store (list() only)...");
    const listed = await listStore(token, args.maxListCalls);
    blobs = listed.blobs;
    listCalls = listed.calls;
    if (blobs.length === 0) fail("The store listed 0 blobs. Wrong token? Stopping without a report.");
  }

  const result = classify(blobs, refs, now, args.graceDays);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dir = resolve(args.out, `${args.dryRun ? "dry-run-" : ""}${stamp}`);
  mkdirSync(dir, { recursive: true });

  const orphans = result.blobs
    .filter((b) => b.status === "ORPHAN_CANDIDATE")
    .map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.toISOString(), band: b.band }));

  writeFileSync(join(dir, "blobs.csv"), blobsCsv(result));
  writeFileSync(join(dir, "orphans.json"), JSON.stringify(orphans, null, 2) + "\n");
  writeFileSync(
    join(dir, "broken-references.csv"),
    toCsv([["url_key", "referenced_by"], ...result.broken.map((b) => [b.key, b.referencedBy.join(" ")])]),
  );
  writeFileSync(
    join(dir, "summary.md"),
    summaryMarkdown(result, {
      generatedAt: now,
      mode: args.dryRun ? "dry-run" : "live",
      graceDays: args.graceDays,
      listCalls,
      databases,
      columnsScanned,
      missingTypedColumns: missing,
    }),
  );

  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);
  console.log(
    `Done. ${result.blobs.length} blobs; ${orphans.length} orphan candidates (${mb(orphanBytes)} MB); ` +
      `${result.broken.length} broken references; ${listCalls} list() calls.`,
  );
  console.log(`Report: ${dir}`);
  console.log("Nothing was deleted. Share summary.md only; the other files contain pathnames.");
}

main().catch((err: unknown) => {
  // Error messages from the SDK and drivers do not include the token or password.
  console.error("blob-audit failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
