"use client";

/**
 * Imports, step 1 (#216): choose what to import, download a template, then
 * pick a CSV. The file is read as text in the browser and sent to A's
 * startImport (1 MB, 2,000 rows); the preview opens on the job's page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, GraduationCap, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { actionError } from "@/features/courses/lib/account-ui";
import { getImportTemplate, startImport } from "@/features/imports/actions";
import { cn } from "@/lib/utils";

import { fieldLabel, importRoutes } from "./import-ui";

export type ImportType = { kind: string; title: string; headers: string[] };

const MAX_BYTES = 1_000_000;

/** What each import does, in a sentence. Unknown kinds show only their title. */
const BLURB: Record<string, string> = {
  students: "New students get a username and a sign-in code; parents are linked by email or get a code too.",
  staff: "Each row gets the usual invitation by email. People already in the workspace are skipped.",
};

export function ImportStart({ types, initialKind }: { types: ImportType[]; initialKind?: string | null }) {
  const router = useRouter();
  const [kind, setKind] = React.useState(types.find((t) => t.kind === initialKind)?.kind ?? types[0]?.kind ?? "");
  const [busy, setBusy] = React.useState<"template" | "upload" | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const type = types.find((t) => t.kind === kind);

  async function template() {
    setBusy("template");
    const res = await getImportTemplate({ kind });
    setBusy(null);
    if (!res?.data) return toast.error(actionError(res, "Couldn't make the template. Try again."));
    const url = URL.createObjectURL(new Blob([res.data.csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: res.data.fileName });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return toast.error("That file is over 1 MB. Split it into smaller files.");
    setBusy("upload");
    try {
      const res = await startImport({ kind, fileName: file.name, text: await file.text() });
      if (!res?.data) {
        setBusy(null);
        return toast.error(actionError(res, "Couldn't read that file. Check it's a CSV and try again."));
      }
      router.push(importRoutes.job(res.data.id));
    } catch {
      setBusy(null);
      toast.error("Couldn't read that file. Check it's a CSV and try again.");
    }
  }

  if (types.length === 0) {
    return <p className="text-muted-foreground text-sm">There&apos;s nothing you can import here.</p>;
  }

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="What to import" className="grid gap-3 sm:grid-cols-2">
        {types.map((t) => {
          const on = t.kind === kind;
          return (
            <button
              key={t.kind}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(t.kind)}
              className={cn(
                "focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-4 text-left outline-none focus-visible:ring-2",
                on ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
              )}
            >
              <span aria-hidden className="bg-muted text-foreground grid size-9 shrink-0 place-items-center rounded-lg">
                {t.kind === "students" ? <GraduationCap className="size-4" /> : <Users className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">{t.title}</span>
                {BLURB[t.kind] ? <span className="text-muted-foreground mt-1 block text-xs">{BLURB[t.kind]}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {type ? (
        <div className="border-border space-y-4 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">Columns</p>
            <p className="text-muted-foreground text-sm">{type.headers.map(fieldLabel).join(" · ")}</p>
            <p className="text-muted-foreground text-xs">
              Other header names often work too. Excel files saved as CSV are fine, with commas or semicolons. Up to 2,000
              rows and 1 MB.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={template} disabled={busy !== null}>
              {busy === "template" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download a template
            </Button>
            <WriteGuard label="Choose a CSV file" variant="default" size="default">
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {busy === "upload" ? "Reading the file…" : "Choose a CSV file"}
              </Button>
            </WriteGuard>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Nothing changes until you check the rows and confirm. You can undo an import for 24 hours.
          </p>
        </div>
      ) : null}
    </div>
  );
}
