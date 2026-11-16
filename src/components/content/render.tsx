/**
 * renderRichContent — a validated rich document to React elements, with no
 * editor and no DOM (contracts/editor.md). Pure, so it runs in server
 * components and in Node checks (scripts/check-rich-render.tsx).
 *
 * Every node renders through its own renderHTML, except:
 * - image: the width attribute becomes a max-width, lazy loading, no drag;
 * - table: wrapped so a wide table scrolls inside the page.
 * Maths nodes emit their TeX in `\( \)` / `\[ \]`; the MathTypeset wrapper
 * (client) has MathJax typeset them in the browser.
 */

import * as React from "react";
import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import { contentExtensions } from "@/lib/content/extensions";

const SAFE_SRC = /^(https?:|\/(?!\/))/i;

export function renderRichContent(doc: JSONContent): React.ReactNode {
  return renderToReactElement({
    content: doc,
    extensions: contentExtensions(),
    options: {
      nodeMapping: {
        image: ({ node }) => {
          const { src, alt, title, width } = node.attrs as { src: string | null; alt: string | null; title: string | null; width: string | null };
          // Only http(s) and same-site paths: never data:, javascript: or protocol-relative URLs.
          if (!src || !SAFE_SRC.test(src)) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element -- Blob and external URLs, sized by the author
            <img
              src={src}
              alt={alt ?? ""}
              title={title ?? undefined}
              loading="lazy"
              draggable={false}
              className="my-4 block rounded-md"
              style={{ maxWidth: width ?? "100%", height: "auto" }}
            />
          );
        },
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto">
            <table>
              <tbody>{children}</tbody>
            </table>
          </div>
        ),
      },
    },
  });
}
