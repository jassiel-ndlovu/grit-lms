"use client";

/**
 * LessonMarkdown — RSC/CSR safe Markdown + MathJax renderer.
 *
 * - Markdown via react-markdown@10 with remark-gfm (tables, task lists,
 *   strikethrough, autolinks).
 * - LaTeX via MathJax v3 (better-react-mathjax). The MathJaxContext lives
 *   higher up in the dashboard layout; this component just wraps its
 *   markdown output in <MathJax dynamic> so MathJax re-typesets when the
 *   DOM changes.
 * - Inline code = no language fence + no inner newlines. react-markdown v10
 *   dropped the `inline` prop; we infer it ourselves.
 */

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MathJax } from "better-react-mathjax";

import { cn } from "@/lib/utils";

export interface LessonMarkdownProps {
  content?: string;
  /** Override prose width / colour overrides if the caller needs to. */
  className?: string;
  /** Cap rendered images at this width (e.g. "100%", "600px"). */
  maxImageWidth?: string;
}

/**
 * Pull a width override out of an image alt text.
 *
 * Convention: alt of `My image [50%]` → 50% width. `[200px]` works too.
 * We keep this private to the component so authors don't need to know it.
 */
function widthFromAlt(alt: string | undefined, fallback: string): string {
  if (!alt) return fallback;
  const m = alt.match(/\[(\d+(?:%|px)?)\]/);
  return m?.[1] ?? fallback;
}

export default function LessonMarkdown({
  content = "",
  className,
  maxImageWidth = "100%",
}: LessonMarkdownProps) {
  return (
    <MathJax dynamic>
      <div
        className={cn(
          "prose prose-sm max-w-none break-words leading-relaxed text-foreground",
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => (
              <h1
                className="font-display mt-8 mb-4 text-2xl leading-tight tracking-tight text-foreground"
                {...props}
              />
            ),
            h2: (props) => (
              <h2
                className="font-display mt-6 mb-3 text-xl leading-tight tracking-tight text-foreground"
                {...props}
              />
            ),
            h3: (props) => (
              <h3
                className="font-display mt-4 mb-2 text-lg leading-tight tracking-tight text-foreground"
                {...props}
              />
            ),
            p: (props) => <p className="my-3 text-foreground" {...props} />,
            strong: (props) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
            em: (props) => <em className="italic" {...props} />,
            ul: (props) => (
              <ul className="my-3 list-disc space-y-1 pl-5" {...props} />
            ),
            ol: (props) => (
              <ol className="my-3 list-decimal space-y-1 pl-5" {...props} />
            ),
            li: (props) => <li className="text-foreground" {...props} />,
            a: ({ href, ...rest }) => (
              <a
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-brand-terracotta hover:underline underline-offset-2"
                {...rest}
              />
            ),
            blockquote: (props) => (
              <blockquote
                className="border-l-2 border-brand-terracotta/40 bg-muted/30 my-4 px-4 py-2 italic text-muted-foreground"
                {...props}
              />
            ),
            hr: () => <hr className="my-6 border-border" />,
            img: ({ alt, src }) => {
              const width = widthFromAlt(alt, maxImageWidth);
              return (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={alt ?? ""}
                  className="border-border mx-auto my-4 rounded-md border"
                  style={{ maxWidth: width, height: "auto" }}
                  loading="lazy"
                />
              );
            },
            table: (props) => (
              <div className="my-4 overflow-x-auto">
                <table
                  className="border-border min-w-full border-collapse border"
                  {...props}
                />
              </div>
            ),
            thead: (props) => (
              <thead className="bg-muted/50" {...props} />
            ),
            tr: (props) => (
              <tr className="border-border border-b" {...props} />
            ),
            th: (props) => (
              <th
                className="border-border border px-3 py-2 text-left text-sm font-semibold"
                {...props}
              />
            ),
            td: (props) => (
              <td className="border-border border px-3 py-2 text-sm" {...props} />
            ),
            // react-markdown v10 dropped the `inline` boolean. Detect inline
            // by absence of language fence + lack of internal newlines.
            code: ({ className: codeClass, children, ...rest }) => {
              const text = String(children ?? "");
              const inline =
                !codeClass?.startsWith("language-") && !text.includes("\n");
              if (inline) {
                return (
                  <code
                    className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.9em]"
                    {...rest}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={cn("text-sm", codeClass)} {...rest}>
                  {children}
                </code>
              );
            },
            pre: (props) => (
              <pre
                className="bg-muted text-foreground my-4 overflow-x-auto rounded-md p-4 text-sm"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MathJax>
  );
}
