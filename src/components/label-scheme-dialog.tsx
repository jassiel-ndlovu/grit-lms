"use client";

/**
 * LabelSchemeDialog — pick how a hierarchy is numbered, enumitem-style.
 *
 * One template per level (see lib/enum-labels.ts for the token syntax),
 * a handful of presets, and a live sample so the tutor sees "1.1.1" or
 * "(a)" before applying.
 */

import * as React from "react";
import { ListOrdered, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LABEL_PRESETS,
  formatLabel,
  normalizeScheme,
  templateError,
  type LabelScheme,
} from "@/lib/enum-labels";

export interface LabelSchemeDialogProps {
  scheme: LabelScheme;
  onChange: (scheme: LabelScheme) => void;
  /** "question" / "lesson" — used in the copy. */
  noun?: string;
  triggerLabel?: string;
}

/** A small sample tree: 2 top-level, the first with 2 children, one grandchild, one great-grandchild. */
const SAMPLE: number[][] = [[0], [0, 0], [0, 0, 0], [0, 0, 0, 0], [0, 1], [1]];

export function LabelSchemeDialog({
  scheme,
  onChange,
  noun = "question",
  triggerLabel = "Numbering",
}: LabelSchemeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [levels, setLevels] = React.useState<string[]>(() => normalizeScheme(scheme));

  React.useEffect(() => {
    if (open) setLevels([...normalizeScheme(scheme)]);
  }, [open, scheme]);

  const presetId =
    LABEL_PRESETS.find(
      (p) => p.scheme.length === levels.length && p.scheme.every((s, i) => s === levels[i]),
    )?.id ?? "custom";

  const errors = levels.map(templateError);
  const valid = errors.every((e) => e === null);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ListOrdered className="size-3.5" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">{noun[0].toUpperCase() + noun.slice(1)} numbering</DialogTitle>
            <DialogDescription>
              Set one label per level, the way you would with LaTeX&apos;s{" "}
              <code className="bg-muted rounded px-1">enumitem</code>. Every {noun} is
              numbered from its position, so reordering renumbers automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Preset</label>
            <Select
              value={presetId}
              onValueChange={(id) => {
                const p = LABEL_PRESETS.find((x) => x.id === id);
                if (p) setLevels([...p.scheme]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom" disabled>
                  Custom
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-foreground text-xs font-medium">Label per level</label>
            {levels.map((tpl, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0 text-xs">Level {i + 1}</span>
                  <Input
                    value={tpl}
                    onChange={(e) =>
                      setLevels((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                    }
                    className="font-mono text-xs"
                    aria-invalid={errors[i] !== null}
                    placeholder={i === 0 ? "\\arabic*" : `\\arabic{enumi}.\\alph*`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8 shrink-0"
                    disabled={levels.length <= 1}
                    onClick={() => setLevels((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove level ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {errors[i] && <p className="text-destructive pl-16 text-xs">{errors[i]}</p>}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                // Extend the deepest level: its own counter becomes a parent
                // reference, e.g. "\arabic{enumi}.\alph*" → "…\alph{enumii}.\arabic*".
                setLevels((prev) => {
                  const last = prev[prev.length - 1] ?? "";
                  const asParent = last.replace(/\*/g, `{${romanCounter(prev.length)}}`);
                  return [...prev, asParent ? `${asParent}.\\arabic*` : "\\arabic*"];
                })
              }
            >
              <Plus className="size-3" /> Add level
            </Button>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Counters: <code>\arabic*</code> <code>\alph*</code> <code>\Alph*</code>{" "}
              <code>\roman*</code> <code>\Roman*</code> for the current level;{" "}
              <code>\arabic&#123;enumi&#125;</code>, <code>\alph&#123;enumii&#125;</code>… for a parent
              level. Everything else is printed as-is. Levels deeper than listed continue as
              &ldquo;parent.1&rdquo;.
            </p>
          </div>

          <div className="bg-muted/40 rounded-md border p-3">
            <p className="text-muted-foreground mb-1.5 text-[11px] uppercase tracking-wide">Example</p>
            <ul className="space-y-0.5 text-sm tabular-nums">
              {SAMPLE.map((path, i) => (
                <li key={i} style={{ paddingLeft: (path.length - 1) * 18 }}>
                  {valid ? formatLabel(levels, path) : "—"}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={!valid}
              onClick={() => {
                onChange(normalizeScheme(levels));
                setOpen(false);
              }}
            >
              Apply numbering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function romanCounter(level: number): string {
  const r = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][level - 1] ?? "i";
  return `enum${r}`;
}
