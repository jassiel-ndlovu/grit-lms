"use client";

import * as React from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Maximize2, PanelRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NexusCorner, NexusLoader } from "@/components/ui/nexus";
import { cn } from "@/lib/utils";

/**
 * Peek: look at a row without leaving the list. The row's own link still
 * opens the page; a small button beside it opens this panel (from the right,
 * or from the bottom on a phone), with next, previous and "Open".
 *
 *   <PeekProvider items={…} load={action} render={(d) => …}>
 *     <ul> … <PeekButton id={row.id} name={row.name} /> … </ul>
 *   </PeekProvider>
 *
 * `load` is a server action that checks permission again; what it returned
 * is kept while the list is on screen.
 */
export type PeekItem = { id: string; title: string; href: string };

type Loaded = { data: unknown } | { error: string };

const Ctx = React.createContext<{ open: (id: string) => void; current: string | null } | null>(null);

export function PeekProvider<T>({ items, load, render, children }: {
  items: PeekItem[];
  /** The record, or null when it isn't there or isn't allowed. */
  load: (id: string) => Promise<T | null>;
  render: (data: T) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [id, setId] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState<Record<string, Loaded>>({});
  const asked = React.useRef(new Set<string>());
  const last = React.useRef<string | null>(null);

  const fetchOne = React.useCallback(
    async (key: string) => {
      if (asked.current.has(key)) return;
      asked.current.add(key);
      const data = await load(key).catch(() => null);
      if (data === null) asked.current.delete(key); // Try again next time it opens.
      setLoaded((l) => ({ ...l, [key]: data === null ? { error: "This couldn't be loaded. Open the full page, or try again." } : { data } }));
    },
    [load],
  );

  const open = React.useCallback(
    (key: string) => {
      setId(key);
      last.current = key;
      void fetchOne(key);
    },
    [fetchOne],
  );

  const at = items.findIndex((i) => i.id === id);
  const item = at >= 0 ? items[at] : null;
  const prev = at > 0 ? items[at - 1] : null;
  const next = at >= 0 ? (items[at + 1] ?? null) : null;
  const state = id ? loaded[id] : undefined;
  const value = React.useMemo(() => ({ open, current: id }), [open, id]);

  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    const to = e.key === "ArrowDown" ? next : e.key === "ArrowUp" ? prev : null;
    if (!to) return;
    e.preventDefault();
    open(to.id);
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <DialogPrimitive.Root open={item !== null} onOpenChange={(o) => !o && setId(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/20" />
          <DialogPrimitive.Content
            data-slot="peek-panel"
            aria-describedby={undefined}
            onKeyDown={onKeyDown}
            onCloseAutoFocus={(e) => {
              // Opened without a Radix trigger, so focus goes back by hand: to the row last looked at.
              e.preventDefault();
              document.querySelector<HTMLElement>(`[data-peek="${CSS.escape(last.current ?? "")}"]`)?.focus();
            }}
            className={cn(
              "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col overflow-hidden shadow-lg outline-none motion-reduce:animate-none",
              "border-border inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
              "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:border-t-0 sm:border-l",
              "sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
            )}
          >
            <div className="border-border flex h-12 shrink-0 items-center gap-1 border-b px-2">
              <Button variant="ghost" size="icon" className="size-8" disabled={!prev} onClick={() => prev && open(prev.id)} aria-label="Previous">
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" disabled={!next} onClick={() => next && open(next.id)} aria-label="Next">
                <ChevronRight aria-hidden className="size-4" />
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
                {at >= 0 ? `${at + 1} of ${items.length}` : ""}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {item ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={item.href}>
                      <Maximize2 aria-hidden className="size-3.5" /> Open
                    </Link>
                  </Button>
                ) : null}
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Close">
                    <X aria-hidden className="size-4" />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>
            <div className="relative isolate flex-1 space-y-5 overflow-y-auto p-5">
              <NexusCorner seed="peek" size={88} />
              <DialogPrimitive.Title className="text-foreground pr-20 text-xl leading-tight font-semibold">{item?.title ?? ""}</DialogPrimitive.Title>
              {!state ? (
                <div className="grid min-h-40 place-items-center">
                  <NexusLoader size={40} />
                </div>
              ) : "error" in state ? (
                <p role="alert" className="text-muted-foreground text-sm">{state.error}</p>
              ) : (
                render(state.data as T)
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </Ctx.Provider>
  );
}

/** Opens the panel for one row. `name` is who or what it shows. */
export function PeekButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const ctx = React.useContext(Ctx);
  if (!ctx) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Peek"
      aria-label={`Peek at ${name}`}
      aria-haspopup="dialog"
      data-peek={id}
      aria-expanded={ctx.current === id}
      onClick={() => ctx.open(id)}
      className={cn("text-muted-foreground hover:text-foreground size-9 shrink-0", className)}
    >
      <PanelRight aria-hidden className="size-4" />
    </Button>
  );
}
