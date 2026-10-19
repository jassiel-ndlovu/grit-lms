"use client";

/**
 * GlobalSearch — the header search box.
 *
 *   - md and up: an inline input with a results dropdown beneath it.
 *   - below md: a search icon that opens the same input + results as a
 *     full-screen sheet, since a dropdown has nowhere to go on a phone.
 *
 * Typing debounces into the `searchEverything` Server Action, which scopes
 * results to what the user can open. Matching nav pages ("settings",
 * "grades") are added client-side as a "Pages" group so the box also works
 * as a quick jump. ⌘K / Ctrl+K focuses it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { searchEverything } from "../actions";
import type { SearchGroup, SearchHit } from "../schemas";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export interface SearchPage {
  label: string;
  link: string;
  description?: string;
}

interface GlobalSearchProps {
  /** Nav pages for the user's role, matched locally as a "Pages" group. */
  pages: ReadonlyArray<SearchPage>;
}

export function GlobalSearch({ pages }: GlobalSearchProps) {
  const search = useSearch(pages);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // ⌘K / Ctrl+K — focus the inline box, or open the sheet on small screens.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) {
          inputRef.current?.focus();
        } else {
          setSheetOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the dropdown on outside click (focus can stay in the input when
  // the user clicks the page, so blur alone isn't enough).
  React.useEffect(() => {
    if (!focused) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [focused]);

  const go = (hit: SearchHit) => {
    setFocused(false);
    setSheetOpen(false);
    inputRef.current?.blur();
    search.reset();
    router.push(hit.href);
  };

  const showDropdown = focused && search.query.trim().length >= MIN_CHARS;

  return (
    <>
      {/* Inline (md+) */}
      <div ref={wrapperRef} className="relative hidden w-full max-w-md md:block">
        <SearchInput
          ref={inputRef}
          search={search}
          onFocus={() => setFocused(true)}
          onEscape={() => {
            setFocused(false);
            inputRef.current?.blur();
          }}
          onPick={go}
          expanded={showDropdown}
        />
        {showDropdown && (
          <div className="border-border bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-md border shadow-lg">
            <SearchResults search={search} onPick={go} />
          </div>
        )}
      </div>

      {/* Icon + full-screen sheet (< md) */}
      <DialogPrimitive.Root
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) search.reset();
        }}
      >
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2 transition-colors md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="bg-background fixed inset-0 z-50 flex flex-col md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <div className="border-border flex items-center gap-2 border-b px-3 py-3">
              <DialogPrimitive.Close
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
                aria-label="Close search"
              >
                <ArrowLeft className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="flex-1">
                <SearchInput
                  autoFocus
                  search={search}
                  onEscape={() => setSheetOpen(false)}
                  onPick={go}
                  expanded={search.query.trim().length >= MIN_CHARS}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {search.query.trim().length >= MIN_CHARS ? (
                <SearchResults search={search} onPick={go} />
              ) : (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Search your courses, lessons, tests, assignments and events.
                </p>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* State                                                                      */
/* ------------------------------------------------------------------------- */

type SearchState = ReturnType<typeof useSearch>;

function useSearch(pages: ReadonlyArray<SearchPage>) {
  const [query, setQuery] = React.useState("");
  const [serverGroups, setServerGroups] = React.useState<SearchGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  // Drops responses that arrive after a newer keystroke.
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const q = query.trim();
    setActiveIndex(0);
    if (q.length < MIN_CHARS) {
      requestId.current += 1;
      setServerGroups([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      const res = await searchEverything({ query: q });
      if (id !== requestId.current) return;
      setLoading(false);
      if (res?.data) {
        setServerGroups(res.data.groups);
        setError(null);
      } else {
        setServerGroups([]);
        setError(res?.serverError ?? "Search failed. Please try again.");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_CHARS) return [];
    const pageHits: SearchHit[] = pages
      .filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      )
      .map((p) => ({ id: p.link, title: p.label, subtitle: p.description, href: p.link }));
    return pageHits.length > 0
      ? [{ key: "pages", label: "Pages", hits: pageHits }, ...serverGroups]
      : serverGroups;
  }, [pages, query, serverGroups]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  return {
    query,
    setQuery,
    groups,
    flat,
    loading,
    error,
    activeIndex,
    setActiveIndex,
    reset: () => setQuery(""),
  };
}

/* ------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* ------------------------------------------------------------------------- */

interface SearchInputProps {
  search: SearchState;
  onPick: (hit: SearchHit) => void;
  onEscape: () => void;
  onFocus?: () => void;
  expanded: boolean;
  autoFocus?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ search, onPick, onEscape, onFocus, expanded, autoFocus }, ref) {
    const { query, setQuery, flat, activeIndex, setActiveIndex, loading } = search;

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (flat.length) setActiveIndex((activeIndex + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (flat.length) setActiveIndex((activeIndex - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter") {
        const hit = flat[activeIndex];
        if (hit) {
          e.preventDefault();
          onPick(hit);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };

    return (
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          ref={ref}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-label="Search"
          autoFocus={autoFocus}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder="Search courses, lessons, tests…"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-md border pr-9 pl-9 text-base transition-shadow focus-visible:ring-2 focus-visible:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>
    );
  },
);

function SearchResults({
  search,
  onPick,
}: {
  search: SearchState;
  onPick: (hit: SearchHit) => void;
}) {
  const { groups, flat, loading, error, activeIndex, setActiveIndex } = search;

  if (error) {
    return <p className="text-destructive px-4 py-4 text-sm">{error}</p>;
  }
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-4 text-sm">
        {loading ? "Searching…" : "No matches."}
      </p>
    );
  }

  return (
    <div id="global-search-results" role="listbox" className="py-2">
      {groups.map((g) => (
        <div key={g.key} className="py-1">
          <p className="text-muted-foreground px-4 pt-1 pb-1 text-[11px] font-medium tracking-wider uppercase">
            {g.label}
          </p>
          <ul>
            {g.hits.map((hit) => {
              const index = flat.indexOf(hit);
              const active = index === activeIndex;
              return (
                <li key={`${g.key}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={(e) => {
                      e.preventDefault();
                      onPick(hit);
                    }}
                    className={cn(
                      "block px-4 py-2 transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="text-foreground block truncate text-sm">
                      {hit.title}
                    </span>
                    {hit.subtitle && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {hit.subtitle}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
