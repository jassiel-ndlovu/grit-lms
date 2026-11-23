/**
 * The import engine (#216, phase 1). Every importer runs the same steps:
 *
 *   1. createImportFor   parse the file, check every row, save a PREVIEW job
 *   2. editImportRowsFor change or remove rows; every row is checked again
 *   3. confirmImportFor  check again, then APPLYING
 *   4. advanceImport     apply rows in batches under a lease, until DONE
 *   5. undoImportFor     within 24 hours: UNDOING, rows reversed newest first
 *
 * Rows commit one by one, so a big import survives timeouts and a bad row
 * fails alone. Applying is driven by `after()` on confirm, by the screen's
 * progress poll (getImportFor) and by the hourly notifications job, each
 * taking the lease so two never apply the same rows. Server only.
 * Contract: docs/revamp/contracts/imports.md.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { effectiveRole } from "@/lib/roles";
import { sealForQueue, unsealFromQueue } from "@/lib/email/queue";
import { UserError } from "@/lib/user-error";

import { CSV_LIMITS, parseCsv } from "./csv";
import { importerFor } from "./registry";
import type { ConfirmOptions, ImportContext, ImportRow, ImportView, Issue, SignInCard } from "./types";

const HOUR = 60 * 60 * 1000;
const UNDO_HOURS = 24;
const LEASE_EXTRA_MS = 30_000;
/** Jobs and their rows are removed after this. */
export const KEEP_DAYS = 30;

export class ImportError extends UserError {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

type JobRow = Awaited<ReturnType<typeof loadJob>>;

async function loadJob(workspaceId: string, jobId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, workspaceId } });
  if (!job) throw new ImportError("Import not found");
  return job;
}

const rowsOf = (job: { rows: Prisma.JsonValue }) => (job.rows ?? []) as unknown as ImportRow[];
const json = (v: unknown) => v as Prisma.InputJsonValue;

function countsOf(rows: ImportRow[]): ImportView["counts"] {
  const c = { create: 0, update: 0, skip: 0, errors: 0, warnings: 0, done: 0, skipped: 0, failed: 0 };
  for (const r of rows) {
    c[r.action]++;
    if (r.issues.some((i) => i.level === "error")) c.errors++;
    else if (r.issues.length) c.warnings++;
    if (r.outcome) c[r.outcome]++;
  }
  return c;
}

function toView(job: NonNullable<JobRow>): ImportView {
  const rows = rowsOf(job);
  const importer = importerFor(job.kind);
  return {
    id: job.id,
    kind: job.kind,
    title: importer?.title ?? job.kind,
    fileName: job.fileName,
    status: job.status,
    rowCount: job.rowCount,
    counts: countsOf(rows),
    progress: { cursor: job.cursor, total: job.rowCount },
    rows: rows.map((r) => ({ ...r, undo: undefined })),
    needs: job.status === "PREVIEW" ? (importer?.needs?.(rows) ?? []) : [],
    hasSignInCards: !!job.secretsSealed && (!job.secretsExpireAt || job.secretsExpireAt > new Date()),
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    undoUntil: job.undoUntil?.toISOString() ?? null,
    error: job.error,
  };
}

/** Runs the importer's checks over every row and writes the results back. */
async function recheck(ctx: ImportContext, kind: string, rows: ImportRow[]): Promise<ImportRow[]> {
  const importer = importerFor(kind);
  if (!importer) throw new ImportError("Unknown import type");
  const checked = await importer.check(ctx, rows.map((r) => r.data));
  return rows.map((r, i) => ({ ...r, action: checked[i].action, issues: checked[i].issues }));
}

/** 1. Reads the file and saves a job in PREVIEW. */
export async function createImportFor(ctx: ImportContext, input: { kind: string; fileName: string; text: string; defaults?: Record<string, string> }): Promise<ImportView> {
  const importer = importerFor(input.kind);
  if (!importer) throw new ImportError("Unknown import type");
  if (input.text.length > CSV_LIMITS.maxBytes) throw new ImportError("That file is too big. Split it into files of up to 1 MB.");
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { timezone: true } });
  const extra = { timeZone: ws.timezone, defaults: input.defaults ?? {} };
  let read: { rows: Record<string, string>[]; fileIssues: Issue[] };
  if (importer.readText) {
    read = importer.readText(input.text, extra);
  } else {
    const table = parseCsv(input.text);
    if (!table.headers.length) throw new ImportError("That file is empty.");
    if (!table.rows.length) throw new ImportError("That file has a header row but no rows under it.");
    read = importer.read(table, extra);
  }
  if (read.rows.length > CSV_LIMITS.maxRows) throw new ImportError(`That file has ${read.rows.length} rows. Split it into files of up to ${CSV_LIMITS.maxRows}.`);
  const fatal = read.fileIssues.filter((i) => i.level === "error");
  if (fatal.length) throw new ImportError(fatal.map((i) => i.message).join(" "));
  if (!read.rows.length) throw new ImportError("There's nothing to import in that file.");
  let rows: ImportRow[] = read.rows.map((data, i) => ({ n: i + 2, data, action: "create", issues: [] }));
  rows = await recheck(ctx, importer.kind, rows);
  const job = await prisma.importJob.create({
    data: {
      workspaceId: ctx.workspaceId, kind: importer.kind, fileName: input.fileName.slice(0, 200), createdById: ctx.actor.userId,
      rowCount: rows.length, rows: json(rows), summary: json({ fileIssues: read.fileIssues }),
    },
  });
  await prisma.auditLog.create({ data: { workspaceId: ctx.workspaceId, actorUserId: ctx.actor.userId, action: "import.create", targetType: "ImportJob", targetId: job.id, data: { kind: importer.kind, rows: rows.length } } });
  return toView(job);
}

/** 2. Edits rows in PREVIEW (changed fields only), removes rows, and checks every row again. */
export async function editImportRowsFor(ctx: ImportContext, jobId: string, input: { edits?: Array<{ n: number; data: Record<string, string> }>; remove?: number[] }): Promise<ImportView> {
  const job = await loadJob(ctx.workspaceId, jobId);
  if (job.status !== "PREVIEW") throw new ImportError("This import can't be changed any more.");
  const remove = new Set(input.remove ?? []);
  const edits = new Map((input.edits ?? []).map((e) => [e.n, e.data]));
  let rows = rowsOf(job)
    .filter((r) => !remove.has(r.n))
    .map((r) => {
      const e = edits.get(r.n);
      if (!e) return r;
      const data = { ...r.data };
      for (const [k, v] of Object.entries(e)) if (k in data) data[k] = String(v).slice(0, 500);
      return { ...r, data };
    });
  if (!rows.length) throw new ImportError("Every row was removed. Cancel the import instead.");
  rows = await recheck(ctx, job.kind, rows);
  const saved = await prisma.importJob.update({ where: { id: job.id }, data: { rows: json(rows), rowCount: rows.length } });
  return toView(saved);
}

/** 3. Confirms. Rows with errors are skipped only when `skipErrors` is true; otherwise they must be fixed first. */
export async function confirmImportFor(ctx: ImportContext, jobId: string, input: { options?: ConfirmOptions; skipErrors?: boolean }, now: Date = new Date()): Promise<ImportView> {
  const job = await loadJob(ctx.workspaceId, jobId);
  if (job.status !== "PREVIEW") throw new ImportError("This import was already confirmed or cancelled.");
  const importer = importerFor(job.kind)!;
  // Check again: accounts, courses or invites may have changed since the preview.
  let rows = await recheck(ctx, job.kind, rowsOf(job));
  const bad = rows.filter((r) => r.issues.some((i) => i.level === "error"));
  if (bad.length && !input.skipErrors) {
    await prisma.importJob.update({ where: { id: job.id }, data: { rows: json(rows) } });
    throw new ImportError(`${bad.length} ${bad.length === 1 ? "row has" : "rows have"} errors. Fix ${bad.length === 1 ? "it" : "them"}, or confirm again to skip ${bad.length === 1 ? "it" : "them"}.`);
  }
  rows = rows.map((r) => (r.issues.some((i) => i.level === "error") ? { ...r, action: "skip" as const } : r));
  const options = input.options ?? {};
  for (const need of importer.needs?.(rows) ?? []) {
    if (!options[need.option]) throw new ImportError(need.message);
  }
  const won = await prisma.importJob.updateMany({
    where: { id: job.id, status: "PREVIEW" },
    data: { status: "APPLYING", rows: json(rows), options: json(options), confirmedAt: now, cursor: 0, leaseUntil: null },
  });
  if (won.count === 0) throw new ImportError("This import was already confirmed or cancelled.");
  await prisma.auditLog.create({ data: { workspaceId: ctx.workspaceId, actorUserId: ctx.actor.userId, action: "import.confirm", targetType: "ImportJob", targetId: job.id, data: { kind: job.kind, rows: rows.length, skipped: bad.length, options: json(options) } } });
  return toView(await loadJob(ctx.workspaceId, job.id));
}

/** Cancels a job still in PREVIEW. */
export async function cancelImportFor(ctx: ImportContext, jobId: string): Promise<ImportView> {
  const won = await prisma.importJob.updateMany({ where: { id: jobId, workspaceId: ctx.workspaceId, status: "PREVIEW" }, data: { status: "CANCELLED", finishedAt: new Date() } });
  if (won.count === 0) throw new ImportError("Only an import that hasn't been confirmed can be cancelled.");
  return toView(await loadJob(ctx.workspaceId, jobId));
}

/** 5. Starts undoing a finished job, newest row first. Rows already in use are kept and say why. */
export async function undoImportFor(ctx: ImportContext, jobId: string, now: Date = new Date()): Promise<ImportView> {
  const job = await loadJob(ctx.workspaceId, jobId);
  if (job.status !== "DONE") throw new ImportError("Only a finished import can be undone.");
  if (!job.undoUntil || job.undoUntil <= now) throw new ImportError("Undo was available for 24 hours after the import finished.");
  const won = await prisma.importJob.updateMany({ where: { id: job.id, status: "DONE" }, data: { status: "UNDOING", cursor: job.rowCount, leaseUntil: null } });
  if (won.count === 0) throw new ImportError("This import is already being undone.");
  await prisma.auditLog.create({ data: { workspaceId: ctx.workspaceId, actorUserId: ctx.actor.userId, action: "import.undo", targetType: "ImportJob", targetId: job.id, data: { kind: job.kind } } });
  return toView(await loadJob(ctx.workspaceId, job.id));
}

/** The job for the screen. Shows `undo` nowhere. */
export async function getImportFor(workspaceId: string, jobId: string): Promise<ImportView> {
  return toView(await loadJob(workspaceId, jobId));
}

/** The workspace's recent imports, newest first, without their rows. */
export async function listImportsFor(workspaceId: string) {
  const jobs = await prisma.importJob.findMany({
    where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, kind: true, fileName: true, status: true, rowCount: true, cursor: true, createdAt: true, finishedAt: true, undoUntil: true, createdById: true },
  });
  return jobs.map((j) => ({ ...j, title: importerFor(j.kind)?.title ?? j.kind, createdAt: j.createdAt.toISOString(), finishedAt: j.finishedAt?.toISOString() ?? null, undoUntil: j.undoUntil?.toISOString() ?? null }));
}

/** Sign-in cards made by a job (new students and parents), until their codes expire. */
export async function signInCardsFor(workspaceId: string, jobId: string, now: Date = new Date()): Promise<SignInCard[]> {
  const job = await loadJob(workspaceId, jobId);
  if (!job.secretsSealed || (job.secretsExpireAt && job.secretsExpireAt <= now)) return [];
  return JSON.parse(unsealFromQueue(job.secretsSealed)) as SignInCard[];
}

/** The context a job runs under, rebuilt from its creator when no request is around (the hourly job). */
async function contextForJob(job: NonNullable<JobRow>): Promise<ImportContext> {
  const actor = await prisma.user.findUniqueOrThrow({ where: { id: job.createdById }, select: { id: true, name: true, platformRole: true, memberships: { where: { workspaceId: job.workspaceId, status: "ACTIVE" }, select: { id: true, role: true, presetRole: true, branchIds: true, customRole: { select: { id: true, name: true, permissions: true, scope: true } } } } } });
  const m = actor.memberships[0];
  const role = m?.role ?? (actor.platformRole === "NEXA_ADMIN" ? "NEXA_ADMIN" : "TUTOR");
  const scope = m ? effectiveRole(m).scope : "WORKSPACE";
  return {
    workspaceId: job.workspaceId, actor: { userId: actor.id, name: actor.name },
    teachingMembershipId: scope !== "WORKSPACE" ? (m?.id ?? null) : null,
    branchIds: scope === "BRANCHES" ? (m?.branchIds ?? []) : [],
    actorRole: role,
  };
}

/**
 * 4. Applies (or undoes) rows for up to `budgetMs`, under a lease so only
 * one caller works on a job at a time. Returns whether the job is finished.
 */
export async function advanceImport(jobId: string, opts: { budgetMs?: number; now?: () => Date } = {}): Promise<{ finished: boolean; status: string }> {
  const clock = opts.now ?? (() => new Date());
  const budget = opts.budgetMs ?? 40_000;
  const start = Date.now();
  const leaseUntil = new Date(clock().getTime() + budget + LEASE_EXTRA_MS);
  const got = await prisma.importJob.updateMany({
    where: { id: jobId, status: { in: ["APPLYING", "UNDOING"] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: clock() } }] },
    data: { leaseUntil },
  });
  const job0 = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
  if (got.count === 0) return { finished: !["APPLYING", "UNDOING"].includes(job0.status), status: job0.status };

  const importer = importerFor(job0.kind);
  const rows = rowsOf(job0);
  let cursor = job0.cursor;
  let cards: SignInCard[] = job0.secretsSealed ? (JSON.parse(unsealFromQueue(job0.secretsSealed)) as SignInCard[]) : [];
  const save = async (extra: Prisma.ImportJobUpdateInput = {}) => {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        rows: json(rows), cursor,
        ...(cards.length ? { secretsSealed: sealForQueue(JSON.stringify(cards)), secretsExpireAt: new Date(Math.min(...cards.map((c) => Date.parse(c.expiresAt)))) } : {}),
        ...extra,
      },
    });
  };

  try {
    if (!importer) throw new Error(`Unknown import type ${job0.kind}`);
    const ctx = await contextForJob(job0);
    const options = (job0.options ?? {}) as ConfirmOptions;

    if (job0.status === "APPLYING") {
      while (cursor < rows.length && Date.now() - start < budget) {
        const row = rows[cursor];
        if (row.action === "skip") {
          rows[cursor] = { ...row, outcome: "skipped", result: row.issues.find((i) => i.level === "error")?.message ?? row.issues[0]?.message ?? "Skipped" };
        } else {
          try {
            const r = await importer.apply(ctx, row, options);
            rows[cursor] = { ...row, outcome: r.outcome, result: r.result, undo: r.undo };
            if (r.cards?.length) cards = [...cards, ...r.cards];
          } catch (e) {
            rows[cursor] = { ...row, outcome: "failed", result: e instanceof UserError ? e.message : "Something went wrong with this row." };
            if (!(e instanceof UserError)) console.error(`[imports] ${job0.kind} row ${row.n}:`, (e as Error).message);
          }
        }
        cursor++;
        if (cursor % 5 === 0) await save();
      }
      const done = cursor >= rows.length;
      const finishedAt = clock();
      await save(done
        ? { status: "DONE", finishedAt, undoUntil: new Date(finishedAt.getTime() + UNDO_HOURS * HOUR), leaseUntil: null, summary: json({ ...(job0.summary as object), ...countsOf(rows) }) }
        : { leaseUntil: null });
      return { finished: done, status: done ? "DONE" : "APPLYING" };
    }

    // UNDOING: from the last applied row back to the first.
    while (cursor > 0 && Date.now() - start < budget) {
      const row = rows[cursor - 1];
      if (row.outcome === "done" && row.undo !== undefined) {
        try {
          const u = await importer.undo(ctx, row.undo);
          rows[cursor - 1] = { ...row, result: u.undone ? "Undone" : `Kept: ${u.note ?? "already in use"}` };
        } catch (e) {
          rows[cursor - 1] = { ...row, result: "Kept: undo failed for this row" };
          console.error(`[imports] undo ${job0.kind} row ${row.n}:`, (e as Error).message);
        }
      }
      cursor--;
      if (cursor % 5 === 0) await save();
    }
    const done = cursor <= 0;
    if (done) cards = [];
    await save(done ? { status: "UNDONE", undoneAt: clock(), leaseUntil: null, secretsSealed: null, secretsExpireAt: null } : { leaseUntil: null });
    return { finished: done, status: done ? "UNDONE" : "UNDOING" };
  } catch (e) {
    console.error(`[imports] job ${jobId} failed:`, (e as Error).message);
    // Save without touching the sealed codes: sealing may be what failed.
    await prisma.importJob.update({
      where: { id: jobId },
      data: { rows: json(rows), cursor, status: "FAILED", error: "The import stopped unexpectedly. Rows applied so far are kept.", finishedAt: clock(), leaseUntil: null },
    });
    return { finished: true, status: "FAILED" };
  }
}

/** For the hourly job: carries on any job whose lease ran out, and clears old jobs and expired codes. */
export async function advanceStaleImports(now: Date = new Date(), budgetMs = 40_000) {
  const start = Date.now();
  const due = await prisma.importJob.findMany({
    where: { status: { in: ["APPLYING", "UNDOING"] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    select: { id: true }, orderBy: { confirmedAt: "asc" }, take: 10,
  });
  let advanced = 0;
  for (const j of due) {
    const left = budgetMs - (Date.now() - start);
    if (left < 5_000) break;
    await advanceImport(j.id, { budgetMs: left });
    advanced++;
  }
  const codesCleared = await prisma.importJob.updateMany({ where: { secretsExpireAt: { lt: now } }, data: { secretsSealed: null, secretsExpireAt: null } });
  const removed = await prisma.importJob.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 24 * HOUR) }, status: { notIn: ["APPLYING", "UNDOING"] } } });
  return { advanced, codesCleared: codesCleared.count, removed: removed.count };
}

export type { Issue };
