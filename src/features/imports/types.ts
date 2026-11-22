/**
 * Shared shapes for the import engine (#216). Client-safe: B's screens read
 * ImportView, and new importers (B's QTI and Common Cartridge parsers)
 * implement Importer. Contract: docs/revamp/contracts/imports.md.
 */

import type { CsvTable } from "./csv";

export type IssueLevel = "error" | "warning";
export type Issue = { field?: string; level: IssueLevel; message: string };

/** What confirming will do with a row. */
export type RowAction = "create" | "update" | "skip";
/** What applying it did. */
export type RowOutcome = "done" | "skipped" | "failed";

/** One row of a job. `data` holds the file's values as strings, so people can edit them in the preview. */
export type ImportRow<D extends Record<string, string> = Record<string, string>> = {
  n: number;
  data: D;
  action: RowAction;
  issues: Issue[];
  outcome?: RowOutcome;
  /** A short line for the person: "Created thandi.m", or why it failed. */
  result?: string;
  /** What undo needs (importer-specific). Never shown. */
  undo?: unknown;
};

export type ImportContext = {
  workspaceId: string;
  actor: { userId: string; name: string };
  /** Set when the actor may act only on the courses this membership teaches or owns (a tutor, or tutor mode). */
  teachingMembershipId: string | null;
  /** The actor's role in the workspace, for checks such as "only owners invite admins". */
  actorRole: "OWNER" | "ADMIN" | "TUTOR" | "NEXA_ADMIN";
};

/** A sign-in card for the printable sheet. Lives sealed on the job until the codes expire. */
export type SignInCard = { name: string; username: string; code: string; expiresAt: string; kind: "student" | "parent"; forStudent?: string };

export type ApplyResult = { outcome: RowOutcome; result: string; undo?: unknown; cards?: SignInCard[] };

/** Options a job may need at confirm time. */
export type ConfirmOptions = { consentAttested?: boolean };

export interface Importer<D extends Record<string, string> = Record<string, string>> {
  /** Stable key, stored on the job: "students", "staff". */
  kind: string;
  title: string;
  /** The template's header row and two example rows, for "Download a template". */
  template: { headers: string[]; examples: string[][] };
  /** Reads a parsed file into rows. File-level problems (no name column) go in `fileIssues` and stop the import. */
  read(table: CsvTable): { rows: D[]; fileIssues: Issue[] };
  /** Checks every row against the file and the workspace. Runs on upload, after every edit, and again at confirm. */
  check(ctx: ImportContext, rows: D[]): Promise<Array<{ action: RowAction; issues: Issue[] }>>;
  /** Options confirm must carry for these rows, with the reason shown to the person. */
  needs?(rows: ImportRow<D>[]): Array<{ option: keyof ConfirmOptions; message: string }>;
  /** Applies one row. Each row commits on its own; a failure fails that row only. */
  apply(ctx: ImportContext, row: ImportRow<D>, options: ConfirmOptions): Promise<ApplyResult>;
  /** Reverses one applied row, if it is still safe to. */
  undo(ctx: ImportContext, undo: unknown): Promise<{ undone: boolean; note?: string }>;
}

/** What B's screens get. */
export type ImportView = {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  status: "PREVIEW" | "APPLYING" | "DONE" | "FAILED" | "UNDOING" | "UNDONE" | "CANCELLED";
  rowCount: number;
  counts: { create: number; update: number; skip: number; errors: number; warnings: number; done: number; skipped: number; failed: number };
  /** Applied rows so far, for a progress bar: cursor / rowCount. */
  progress: { cursor: number; total: number };
  rows: ImportRow[];
  needs: Array<{ option: keyof ConfirmOptions; message: string }>;
  hasSignInCards: boolean;
  createdAt: string;
  finishedAt: string | null;
  undoUntil: string | null;
  error: string | null;
};
