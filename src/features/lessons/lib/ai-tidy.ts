/** What AI tidying can work on (contracts/viewer.md). Pure. */

import { AI_ASSIST_INPUT } from "@/features/ai-assist/limits";

type Node = { type?: string; content?: Node[] };

/** Blocks that survive a trip to text and back. */
const CARRIED = new Set([
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "text", "hardBreak", "inlineMath", "blockMath",
]);
const NAMES: Record<string, string> = { image: "an image", table: "a table", graph: "a graph", codeBlock: "code" };

/** The first block that wouldn't survive, in words, or null. */
export function blockedBlock(nodes: readonly Node[]): string | null {
  for (const n of nodes) {
    if (!n.type || !CARRIED.has(n.type)) return NAMES[n.type ?? ""] ?? "a block that can't be rewritten";
    const inner = blockedBlock(n.content ?? []);
    if (inner) return inner;
  }
  return null;
}

/** Why this text can't be tidied, or null when it can. */
export function tidyProblem(nodes: readonly Node[], text: string, whole: boolean): string | null {
  const what = whole ? "The lesson" : "Your selection";
  const t = text.trim();
  if (t.length < 20) return whole ? "Write a few sentences first." : "Select a bit more text first.";
  const block = blockedBlock(nodes);
  if (block) return `${what} has ${block} in it, which the AI would lose. Select only the text before or after it.`;
  if (t.length > AI_ASSIST_INPUT.tidyChars) return `${what} is too long to do at once. Select one section at a time.`;
  return null;
}
