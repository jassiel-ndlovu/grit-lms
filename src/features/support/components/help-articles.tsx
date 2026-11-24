"use client";

/**
 * Searchable help articles (support.md). Each article ends with a way to ask
 * about it, prefilled with its topic.
 */

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import { searchArticles, type HelpArticle } from "../help-articles";

/** `askBase` is the form's URL; the article's topic is added (e.g. "/dashboard/help/new?from=/x"). */
export function HelpArticles({ articles, askBase }: { articles: readonly HelpArticle[]; askBase: string }) {
  const [query, setQuery] = React.useState("");
  const askHref = (topic: string) => (askBase.startsWith("#") ? askBase : `${askBase}${askBase.includes("?") ? "&" : "?"}topic=${topic}`);
  const shown = React.useMemo(() => searchArticles(articles, query), [articles, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative sm:max-w-md">
        <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help, for example: password, pay fees" aria-label="Search help" className="pl-9" />
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing matches &ldquo;{query}&rdquo;. Try other words, or <Link className="text-primary underline underline-offset-2" href={askHref("OTHER")}>ask us directly</Link>.
        </p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {shown.map((a) => (
            <details key={a.id} className="group px-4 py-3" open={shown.length === 1}>
              <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium marker:hidden">
                <span>{a.title}</span>
                <span aria-hidden className="text-muted-foreground shrink-0 text-xs transition-transform group-open:rotate-90">▸</span>
              </summary>
              <div className="text-muted-foreground mt-2 flex flex-col gap-2 text-sm leading-relaxed">
                {a.body.map((para, i) => (
                  <p key={i} className={/^\d+\./.test(para) ? "text-foreground pl-1" : undefined}>{para}</p>
                ))}
                <p className="pt-1 text-xs">
                  Didn&apos;t solve it? <Link className="text-primary underline underline-offset-2" href={askHref(a.topic)}>Ask about this</Link>
                </p>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
