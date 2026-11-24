/**
 * renderRichContent — a validated rich document to React elements, with no
 * editor and no DOM (contracts/editor.md). Pure, so it runs in server
 * components and in Node checks (scripts/check-rich-render.tsx).
 *
 * Every node renders through its own renderHTML, except:
 * - image: the width attribute becomes a max-width, lazy loading, no drag;
 * - table: wrapped so a wide table scrolls inside the page;
 * - graph: GraphFigure, which draws it with Mafs in the browser.
 * Maths nodes emit their TeX in `\( \)` / `\[ \]`; the MathTypeset wrapper
 * (client) has MathJax typeset them in the browser.
 */

import * as React from "react";
import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import { contentExtensions } from "@/lib/content/extensions";
import { graphNodeSpec } from "@/lib/content/graph";

import { SaverImage } from "../data-saver";
import { GraphFigure } from "./graph-figure";

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
            // Held back behind "Show image" while data saver is on.
            <SaverImage
              src={src}
              alt={alt ?? ""}
              title={title ?? undefined}
              className="my-4 block rounded-md"
              style={{ maxWidth: width ?? "100%", height: "auto" }}
            />
          );
        },
        graph: ({ node }) => {
          const spec = graphNodeSpec(node.attrs);
          return spec ? <GraphFigure spec={spec} /> : null;
        },
        table: ({ children }) => (
          <div className="relative my-4 overflow-x-auto">
            <table>
              <tbody>{children}</tbody>
            </table>
          </div>
        ),
      },
    },
  });
}
