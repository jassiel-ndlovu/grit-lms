"use client";

/**
 * CommandPalette — the Ctrl+K / ⌘K box: type to filter, arrows to move,
 * Enter to open, Escape to close. Generic: the caller supplies the groups
 * (pages, actions, search hits) and may react to the query to fetch more.
 *
 * Built on the Radix dialog already in the app, with ARIA combobox and
 * listbox roles; no extra dependency. Static items are filtered here by a
 * case-insensitive match on label and keywords; groups marked `remote`
 * are shown as given (the caller already filtered them on the server).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  /** Navigate here on select, or run `onSelect`. */
  href?: string;
  onSelect?: () => void;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
  /** Items already match the query (e.g. server search results). */
  remote?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  /** Shown under the list, e.g. "Searching…". */
  status?: React.ReactNode;
}

function matches(item: CommandItem, q: string) {
  if (!q) return true;
  const hay = [item.label, item.hint ?? "", ...(item.keywords ?? [])].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  onQueryChange,
  placeholder = "Search or jump to…",
  status,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const visible = React.useMemo(
    () =>
      groups
        .map((g) => ({ ...g, items: g.remote ? g.items : g.items.filter((i) => matches(i, query.trim())) }))
        .filter((g) => g.items.length > 0),
    [groups, query],
  );
  const flat = visible.flatMap((g) => g.items);

  React.useEffect(() => setActive(0), [query, groups]);
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    if (item.onSelect) item.onSelect();
    else if (item.href) router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[active]);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  let index = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="bg-popover text-popover-foreground border-border fixed top-[15vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border shadow-xl"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="border-border flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={flat.length ? optionId(active) : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onQueryChange?.(e.target.value);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="placeholder:text-muted-foreground h-11 flex-1 bg-transparent text-sm outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1">
            {visible.map((g) => (
              <div key={g.label} role="group" aria-label={g.label} className="py-1">
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">{g.label}</p>
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  return (
                    <div
                      key={item.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm [&_svg]:text-muted-foreground [&_svg]:size-4",
                        i === active && "bg-accent text-accent-foreground",
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint ? <span className="text-muted-foreground truncate text-xs">{item.hint}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {flat.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">No matches</p>
            ) : null}
          </div>
          {status ? <div className="border-border text-muted-foreground border-t px-3 py-2 text-xs">{status}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Open the palette with Ctrl+K / ⌘K from anywhere on the page. */
export function useCommandPaletteShortcut(setOpen: (open: boolean) => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
