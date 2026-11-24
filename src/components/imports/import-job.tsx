"use client";

/**
 * Imports, steps 2 to 6 (#216): one screen for a job, whatever its state.
 *
 *   PREVIEW            every row with its problems; cells can be edited and
 *                      rows removed (editImportRows), then confirm with the
 *                      job's `needs` ticked and, if errors remain, "skip the
 *                      rows with errors"
 *   APPLYING/UNDOING   a progress bar; polls getImport every 2 s, which
 *                      also keeps A's job moving
 *   DONE               the outcome per row, sign-in cards, undo for 24 h
 *   FAILED/UNDONE/CANCELLED  what happened
 *
 * Sign-in codes never pass through here: the cards page fetches them.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleSlash, IdCard, Loader2, Trash2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actionError } from "@/features/courses/lib/account-ui";
import { cancelImport, confirmImport, editImportRows, getImport, undoImport } from "@/features/imports/actions";
import type { ConfirmOptions, ImportRow, ImportView } from "@/features/imports/types";
import { cn } from "@/lib/utils";

import {
  canConfirm, canUndo, cellIssue, columnsOf, fieldLabel, hasError, hasProblem, importRoutes, isWorking, pendingEdits,
  progressPercent, rowIssues, rowsLabel, toImport,
} from "./import-ui";

const POLL_MS = 2000;

/** `headers`: the template's columns, which set the table's column order. */
export function ImportJob({ initial, headers = [] }: { initial: ImportView; headers?: string[] }) {
  const router = useRouter();
  const [view, setView] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Poll while A's job applies or undoes; stop on any other state.
  React.useEffect(() => {
    if (!isWorking(view.status)) return;
    let stop = false;
    const t = window.setTimeout(async () => {
      const res = await getImport({ jobId: view.id });
      if (stop) return;
      if (res?.data) setView(res.data);
    }, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [view]);

  // On any change of state, refresh the server parts: the header's status
  // chip, and Students or Members once an import finishes.
  const prevStatus = React.useRef(view.status);
  React.useEffect(() => {
    if (prevStatus.current !== view.status) router.refresh();
    prevStatus.current = view.status;
  }, [view.status, router]);

  async function run<T extends { data?: ImportView; serverError?: string; validationErrors?: unknown } | undefined>(
    key: string,
    call: () => Promise<T>,
    fallback: string,
  ): Promise<boolean> {
    setBusy(key);
    try {
      const res = await call();
      if (res?.data) {
        setView(res.data);
        return true;
      }
      toast.error(actionError(res, fallback));
      return false;
    } catch {
      toast.error(fallback);
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {view.status === "CANCELLED" ? null : <Counts view={view} />}
      {view.status === "PREVIEW" ? <Preview view={view} headers={headers} busy={busy} run={run} /> : null}
      {isWorking(view.status) ? <Progress view={view} /> : null}
      {view.status === "DONE" || view.status === "UNDONE" ? <Outcome view={view} headers={headers} busy={busy} run={run} /> : null}
      {view.status === "FAILED" ? (
        <p role="alert" className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
          The import stopped: {view.error ?? "something went wrong"}. Rows already imported stay; their results are below.
        </p>
      ) : null}
      {view.status === "FAILED" ? <OutcomeTable view={view} headers={headers} /> : null}
      {view.status === "CANCELLED" ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
          This import was cancelled before anything changed.{" "}
          <Link href={importRoutes.start(view.kind)} className="text-foreground underline underline-offset-2">
            Start a new one
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

type Run = <T extends { data?: ImportView; serverError?: string; validationErrors?: unknown } | undefined>(
  key: string,
  call: () => Promise<T>,
  fallback: string,
) => Promise<boolean>;

/* ─── Counts ─────────────────────────────────────────────────────────── */

function Counts({ view }: { view: ImportView }) {
  const c = view.counts;
  const items =
    view.status === "PREVIEW"
      ? [
          { label: "New", value: c.create },
          { label: "Updates", value: c.update },
          { label: "Skipped", value: c.skip },
          { label: "With errors", value: c.errors, tone: c.errors ? "text-destructive" : undefined },
          { label: "Warnings", value: c.warnings, tone: c.warnings ? "text-warning" : undefined },
        ]
      : [
          { label: "Imported", value: c.done },
          { label: "Skipped", value: c.skipped },
          { label: "Failed", value: c.failed, tone: c.failed ? "text-destructive" : undefined },
        ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="border-border rounded-lg border px-3 py-2">
          <dt className="text-muted-foreground text-xs">{i.label}</dt>
          <dd className={cn("text-foreground text-lg font-semibold tabular-nums", i.tone)}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── Preview, edit, confirm ─────────────────────────────────────────── */

function Preview({ view, headers, busy, run }: { view: ImportView; headers: string[]; busy: string | null; run: Run }) {
  const [drafts, setDrafts] = React.useState<Record<number, Record<string, string>>>({});
  const [onlyProblems, setOnlyProblems] = React.useState(view.counts.errors + view.counts.warnings > 0);
  const [ticked, setTicked] = React.useState<Record<string, boolean>>({});
  const [skipErrors, setSkipErrors] = React.useState(false);
  const columns = React.useMemo(() => columnsOf(view.rows, headers), [view.rows, headers]);
  const edits = pendingEdits(view, drafts);
  const shown = onlyProblems ? view.rows.filter(hasProblem) : view.rows;

  const setCell = (n: number, field: string, value: string) =>
    setDrafts((d) => ({ ...d, [n]: { ...(d[n] ?? {}), [field]: value } }));

  async function save() {
    const ok = await run("save", () => editImportRows({ jobId: view.id, edits }), "Couldn't save the changes. Try again.");
    if (ok) setDrafts({});
  }
  async function remove(n: number) {
    await run(`remove-${n}`, () => editImportRows({ jobId: view.id, remove: [n] }), "Couldn't remove the row. Try again.");
  }
  const confirmable = canConfirm(view, ticked, skipErrors) && edits.length === 0;
  const count = toImport(view, skipErrors);

  return (
    <div className="space-y-6">
      <section aria-labelledby="rows-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rows-heading" className="text-foreground text-sm font-semibold">
            Check the rows
          </h2>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Checkbox checked={onlyProblems} onCheckedChange={(v) => setOnlyProblems(v === true)} />
            Only rows with problems
          </label>
        </div>
        <p className="text-muted-foreground text-sm">
          Fix a cell by typing in it, then save. Rows are checked again after every change.
        </p>
        {shown.length === 0 ? (
          <p className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {onlyProblems ? "No problems. Every row is ready." : "No rows left."}
          </p>
        ) : (
          <div className="relative border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Line
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Does
                  </th>
                  {columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-medium">
                      {fieldLabel(c)}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {shown.map((r) => (
                  <PreviewRow
                    key={r.n}
                    row={r}
                    columns={columns}
                    draft={drafts[r.n]}
                    onCell={setCell}
                    onRemove={() => remove(r.n)}
                    removing={busy === `remove-${r.n}`}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {edits.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes ({edits.length} {edits.length === 1 ? "row" : "rows"})
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDrafts({})} disabled={busy !== null}>
              Discard
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="confirm-heading" className="border-border space-y-3 rounded-lg border p-4">
        <h2 id="confirm-heading" className="text-foreground text-sm font-semibold">
          Import
        </h2>
        {view.needs.map((n) => (
          <label key={n.option} className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={ticked[n.option] === true}
              onCheckedChange={(v) => setTicked((t) => ({ ...t, [n.option]: v === true }))}
            />
            <span>{n.message}</span>
          </label>
        ))}
        {view.counts.errors > 0 ? (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={skipErrors} onCheckedChange={(v) => setSkipErrors(v === true)} />
            <span>
              Skip the {rowsLabel(view.counts.errors)} with errors and import the rest.
            </span>
          </label>
        ) : null}
        {edits.length > 0 ? <p className="text-muted-foreground text-xs">Save or discard your changes first.</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <WriteGuard label="Import" variant="default" size="default">
            <Button
              type="button"
              disabled={!confirmable || busy !== null}
              onClick={() =>
                run(
                  "confirm",
                  () => confirmImport({ jobId: view.id, options: ticked as ConfirmOptions, skipErrors }),
                  "Couldn't start the import. Try again.",
                )
              }
            >
              {busy === "confirm" ? <Loader2 className="size-4 animate-spin" /> : null}
              Import {rowsLabel(count)}
            </Button>
          </WriteGuard>
          <WriteGuard label="Cancel import">
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => run("cancel", () => cancelImport({ jobId: view.id }), "Couldn't cancel. Try again.")}
            >
              Cancel import
            </Button>
          </WriteGuard>
        </div>
        <p className="text-muted-foreground text-xs">You can undo it for 24 hours afterwards.</p>
      </section>
    </div>
  );
}

const ACTION_LABEL: Record<ImportRow["action"], string> = { create: "New", update: "Update", skip: "Skip" };

function PreviewRow({
  row, columns, draft, onCell, onRemove, removing,
}: {
  row: ImportRow;
  columns: string[];
  draft?: Record<string, string>;
  onCell: (n: number, field: string, value: string) => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const general = rowIssues(row.issues);
  const bad = hasError(row);
  return (
    <>
      <tr className={cn(bad && "bg-destructive/5")}>
        <td className="text-muted-foreground px-3 py-1.5 align-top tabular-nums">{row.n}</td>
        <td className="px-3 py-1.5 align-top text-xs whitespace-nowrap">{bad ? <span className="text-destructive">Error</span> : ACTION_LABEL[row.action]}</td>
        {columns.map((c) => {
          const issue = cellIssue(row.issues, c);
          const id = `cell-${row.n}-${c}`;
          return (
            <td key={c} className="px-1.5 py-1 align-top">
              <input
                aria-label={`${fieldLabel(c)}, line ${row.n}`}
                aria-invalid={issue?.level === "error" || undefined}
                aria-describedby={issue ? `${id}-issue` : undefined}
                value={draft?.[c] ?? row.data[c] ?? ""}
                onChange={(e) => onCell(row.n, c, e.target.value)}
                className={cn(
                  "focus-visible:ring-ring bg-background w-full min-w-28 rounded border px-2 py-1 text-sm outline-none focus-visible:ring-2",
                  issue?.level === "error" ? "border-destructive" : issue ? "border-warning" : "border-transparent hover:border-input",
                )}
              />
              {issue ? (
                <p id={`${id}-issue`} className={cn("mt-0.5 max-w-56 text-xs", issue.level === "error" ? "text-destructive" : "text-muted-foreground")}>
                  {issue.message}
                </p>
              ) : null}
            </td>
          );
        })}
        <td className="px-1.5 py-1 align-top">
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={removing} aria-label={`Remove line ${row.n}`}>
            {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </td>
      </tr>
      {general.length ? (
        <tr className={cn(bad && "bg-destructive/5")}>
          <td />
          <td colSpan={columns.length + 2} className="px-3 pb-2 text-xs">
            {general.map((i, k) => (
              <p key={k} className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                {i.level === "error" ? <XCircle aria-hidden className="mr-1 inline size-3" /> : <AlertTriangle aria-hidden className="mr-1 inline size-3" />}
                {i.message}
              </p>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* ─── Progress ───────────────────────────────────────────────────────── */

function Progress({ view }: { view: ImportView }) {
  const pct = progressPercent(view);
  const undoing = view.status === "UNDOING";
  return (
    <section aria-labelledby="progress-heading" className="border-border space-y-3 rounded-lg border p-4">
      <h2 id="progress-heading" className="text-foreground flex items-center gap-2 text-sm font-semibold">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {undoing ? "Undoing the import…" : "Importing…"}
      </h2>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={undoing ? "Undo progress" : "Import progress"}
        className="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {undoing ? view.progress.total - view.progress.cursor : view.progress.cursor} of {view.progress.total} · You can leave this
        page; it carries on.
      </p>
    </section>
  );
}

/* ─── Outcome, cards, undo ───────────────────────────────────────────── */

function Outcome({ view, headers, busy, run }: { view: ImportView; headers: string[]; busy: string | null; run: Run }) {
  const [asking, setAsking] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const undoable = canUndo(view, now);

  return (
    <div className="space-y-6">
      {view.status === "UNDONE" ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          This import was undone. Rows that couldn&apos;t be undone say why below.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {view.hasSignInCards && view.status === "DONE" ? (
          <Button asChild>
            <Link href={importRoutes.cards(view.id)}>
              <IdCard className="size-4" /> Print sign-in cards
            </Link>
          </Button>
        ) : null}
        {undoable ? (
          <WriteGuard label="Undo this import">
            <Button type="button" variant="outline" onClick={() => setAsking(true)} disabled={busy !== null}>
              <Undo2 className="size-4" /> Undo this import
            </Button>
          </WriteGuard>
        ) : null}
      </div>
      {view.hasSignInCards && view.status === "DONE" ? (
        <p className="text-muted-foreground text-xs">New students and parents sign in with the codes on their cards. The codes work for 14 days.</p>
      ) : null}
      <OutcomeTable view={view} headers={headers} />

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              Students, parents and invitations it made are removed, and course places it added are taken back. Anyone who has
              already signed in or accepted stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void run("undo", () => undoImport({ jobId: view.id }), "Couldn't undo the import. Try again.")}
            >
              Undo the import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const OUTCOME = {
  done: { label: "Imported", icon: CheckCircle2, cls: "text-success" },
  skipped: { label: "Skipped", icon: CircleSlash, cls: "text-muted-foreground" },
  failed: { label: "Failed", icon: XCircle, cls: "text-destructive" },
} as const;

function OutcomeTable({ view, headers }: { view: ImportView; headers: string[] }) {
  const first = columnsOf(view.rows, headers)[0];
  const applied = view.rows.filter((r) => r.outcome);
  if (applied.length === 0) return null;
  return (
    <section aria-labelledby="results-heading" className="space-y-2">
      <h2 id="results-heading" className="text-foreground text-sm font-semibold">
        Results
      </h2>
      <ul className="divide-border border-border divide-y rounded-lg border">
        {applied.map((r) => {
          const o = OUTCOME[r.outcome!];
          const Icon = o.icon;
          return (
            <li key={r.n} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="text-muted-foreground w-10 tabular-nums">{r.n}</span>
              <span className={cn("flex w-24 items-center gap-1", o.cls)}>
                <Icon aria-hidden className="size-3.5" /> {o.label}
              </span>
              <span className="text-foreground min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{first ? r.data[first] : ""}</span>
              {r.result ? <span className="text-muted-foreground w-full pl-[8.5rem] text-xs sm:w-auto sm:pl-0">{r.result}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
