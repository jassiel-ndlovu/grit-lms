/**
 * RichContent — read-only view of a rich field (contracts/editor.md).
 *
 *   <RichContent value={lesson.descriptionJson} markdown={lesson.description} />
 *
 * Renders the JSON when it is valid rich content this build understands;
 * otherwise falls back to the markdown column with today's LessonMarkdown,
 * so a field shows the same before and after it moves to the editor.
 *
 * Server component: the document renders on the server and ships as HTML.
 * Only the MathJax typeset pass runs in the browser.
 */

import LessonMarkdown from "@/app/components/markdown";
import { validateDoc } from "@/lib/content/schema";
import { readStoredContent } from "@/lib/content/value";
import { cn } from "@/lib/utils";

import "./rich-content.css";
import { MathTypeset } from "./math-typeset";
import { renderRichContent } from "./render";

interface RichContentProps {
  /** The `xJson` column, as read from the database. */
  value: unknown;
  /** The `x` markdown column: the fallback. */
  markdown?: string | null;
  className?: string;
}

/**
 * A short fingerprint of the content (FNV-1a), used as the React key.
 * MathJax typesets once, on mount, and rewrites the DOM under React. When a
 * page swaps one lesson for another in place (the learner page's ?lesson=
 * links), the new content must remount, or it shows the old formulas or raw
 * TeX.
 */
function contentKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ":" + text.length.toString(36);
}

export function RichContent({ value, markdown, className }: RichContentProps) {
  const stored = readStoredContent(value);
  // Saved documents were validated on write; check again, since a bad row
  // should fall back to markdown rather than render something unexpected.
  const doc = stored ? validateDoc(stored.doc) : null;

  if (!doc) {
    return markdown ? (
      <LessonMarkdown key={contentKey(markdown)} content={markdown} dynamic={false} className={className} />
    ) : null;
  }

  return (
    <MathTypeset key={contentKey(JSON.stringify(doc))}>
      <div data-slot="rich-content" className={cn("text-sm", className)}>
        {renderRichContent(doc)}
      </div>
    </MathTypeset>
  );
}
