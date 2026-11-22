"use server";

/**
 * Import actions for B's screens (#216, phase 1). Contract:
 * docs/revamp/contracts/imports.md.
 *
 * Who may import: "students" needs learners.invite (a tutor only into their
 * own courses); "staff" needs members.invite for the whole workspace.
 * A tutor sees only the imports they started. Writes are refused in a
 * read-only workspace.
 */

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";
import { can, needsScope, type Permission, type Viewer } from "@/lib/viewer-core";

import { toCsv } from "./csv";
import * as engine from "./engine";
import { importerFor, importerKinds } from "./registry";
import type { ImportContext } from "./types";

const PERMISSION: Record<string, Permission> = { students: "learners.invite", staff: "members.invite" };
const id = z.string().min(1).max(64);

function contextFor(viewer: Viewer, kind: string): ImportContext {
  const permission = PERMISSION[kind];
  if (!permission || !viewer.workspace || !can(viewer, permission)) throw new ViewerError("FORBIDDEN");
  const scoped = needsScope(viewer, permission);
  if (scoped && kind === "staff") throw new ViewerError("FORBIDDEN");
  if (scoped && !viewer.membership) throw new ViewerError("FORBIDDEN");
  const actorRole = viewer.persona === "admin" ? "NEXA_ADMIN" : viewer.mode === "tutor" ? "TUTOR" : (viewer.membership?.role ?? "TUTOR");
  return {
    workspaceId: viewer.workspace.id,
    actor: { userId: viewer.user.id, name: viewer.user.name },
    teachingMembershipId: scoped ? viewer.membership!.id : null,
    actorRole,
  };
}

/** The job's context, checking the viewer may see it: scoped viewers see only their own imports. */
async function jobContext(viewer: Viewer, jobId: string) {
  if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
  const job = await prisma.importJob.findFirst({ where: { id: jobId, workspaceId: viewer.workspace.id }, select: { kind: true, createdById: true, status: true, leaseUntil: true } });
  if (!job) throw new engine.ImportError("Import not found");
  const ctx = contextFor(viewer, job.kind);
  if (ctx.teachingMembershipId && job.createdById !== viewer.user.id) throw new ViewerError("FORBIDDEN");
  return { ctx, job };
}

function keepGoing(jobId: string) {
  after(() => engine.advanceImport(jobId).catch((e) => console.error("[imports] advance failed:", (e as Error).message)));
}

/** The import types the viewer may run, each with its template. */
export const listImportTypes = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) =>
    importerKinds()
      .filter((k) => { try { contextFor(viewer, k.kind); return true; } catch { return false; } })
      .map((k) => ({ kind: k.kind, title: k.title, headers: k.template.headers })),
  );

/** A template CSV (header row and two example rows) for "Download a template". */
export const getImportTemplate = viewerActionClient
  .schema(z.object({ kind: z.string().max(40) }))
  .action(async ({ parsedInput: { kind }, ctx: { viewer } }) => {
    contextFor(viewer, kind);
    const t = importerFor(kind)!.template;
    return { fileName: `nexa-${kind}-template.csv`, csv: toCsv(t.headers, t.examples) };
  });

/** 1. Reads a CSV file (sent as text, up to 1 MB and 2,000 rows) and returns the preview. */
export const startImport = writableViewerActionClient
  .schema(z.object({ kind: z.string().max(40), fileName: z.string().min(1).max(200), text: z.string().max(1_100_000) }))
  .action(async ({ parsedInput, ctx: { viewer } }) => engine.createImportFor(contextFor(viewer, parsedInput.kind), parsedInput));

/** 2. Changes cells in the preview (by row number `n`) and removes rows; every row is checked again. */
export const editImportRows = writableViewerActionClient
  .schema(z.object({
    jobId: id,
    edits: z.array(z.object({ n: z.number().int().min(1), data: z.record(z.string(), z.string().max(500)) })).max(500).optional(),
    remove: z.array(z.number().int().min(1)).max(2000).optional(),
  }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const { ctx } = await jobContext(viewer, parsedInput.jobId);
    return engine.editImportRowsFor(ctx, parsedInput.jobId, parsedInput);
  });

/** 3. Confirms and starts applying in the background. Poll getImport for progress. */
export const confirmImport = writableViewerActionClient
  .schema(z.object({ jobId: id, options: z.object({ consentAttested: z.boolean().optional() }).optional(), skipErrors: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const { ctx } = await jobContext(viewer, parsedInput.jobId);
    const view = await engine.confirmImportFor(ctx, parsedInput.jobId, parsedInput);
    keepGoing(parsedInput.jobId);
    return view;
  });

/** The job with every row. While it's applying or undoing, polling this also keeps it moving. */
export const getImport = viewerActionClient
  .schema(z.object({ jobId: id }))
  .action(async ({ parsedInput: { jobId }, ctx: { viewer } }) => {
    const { ctx, job } = await jobContext(viewer, jobId);
    if ((job.status === "APPLYING" || job.status === "UNDOING") && (!job.leaseUntil || job.leaseUntil < new Date())) keepGoing(jobId);
    return engine.getImportFor(ctx.workspaceId, jobId);
  });

/** Recent imports (a tutor sees their own). */
export const listImports = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => {
    if (!viewer.workspace) throw new ViewerError("FORBIDDEN");
    const all = await engine.listImportsFor(viewer.workspace.id);
    return all.filter((j) => {
      try {
        const c = contextFor(viewer, j.kind);
        return !c.teachingMembershipId || j.createdById === viewer.user.id;
      } catch {
        return false;
      }
    }).map((j) => ({ ...j, createdById: undefined }));
  });

export const cancelImport = writableViewerActionClient
  .schema(z.object({ jobId: id }))
  .action(async ({ parsedInput: { jobId }, ctx: { viewer } }) => {
    const { ctx } = await jobContext(viewer, jobId);
    return engine.cancelImportFor(ctx, jobId);
  });

/** 5. Undoes a finished import within 24 hours, in the background. */
export const undoImport = writableViewerActionClient
  .schema(z.object({ jobId: id }))
  .action(async ({ parsedInput: { jobId }, ctx: { viewer } }) => {
    const { ctx } = await jobContext(viewer, jobId);
    const view = await engine.undoImportFor(ctx, jobId);
    keepGoing(jobId);
    revalidatePath("/dashboard", "layout");
    return view;
  });

/** The printable sign-in cards for new students and parents, until the codes expire (14 days). Audited. */
export const getSignInCards = viewerActionClient
  .schema(z.object({ jobId: id }))
  .action(async ({ parsedInput: { jobId }, ctx: { viewer } }) => {
    const { ctx } = await jobContext(viewer, jobId);
    const cards = await engine.signInCardsFor(ctx.workspaceId, jobId);
    if (cards.length) await prisma.auditLog.create({ data: { workspaceId: ctx.workspaceId, actorUserId: viewer.user.id, action: "import.cards_view", targetType: "ImportJob", targetId: jobId, data: { cards: cards.length } } });
    return cards;
  });
