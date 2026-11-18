import "server-only";

/**
 * The two columns a server action writes for a rich field `x`
 * (contracts/editor.md, rules 1 and 2): `xJson` and the markdown copy in
 * `x`, always together. Shared by every feature that saves rich content.
 *
 *   const body = richColumnsFromInput(parsedInput.descriptionJson, "assignments");
 *   data.description = body.markdown;
 *   data.descriptionJson = body.json;
 */

import { Prisma } from "@/generated/prisma";

import { richFieldFromInput, richFieldRefusal } from "./save";

export interface RichColumns {
  /** The derived markdown; "" when the document is empty. */
  markdown: string;
  /** The validated envelope, or DbNull when the document is empty. */
  json: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

/**
 * The envelope a browser sent (null clears the field). Throws a message
 * fit for the user when the document can't be read, and logs why under
 * `[area]`, naming the rule, not the content.
 */
export function richColumnsFromInput(value: unknown, area: string): RichColumns {
  if (value === null) return { markdown: "", json: Prisma.DbNull };
  const rich = richFieldFromInput(value);
  if (!rich) {
    console.error(`[${area}] rich content refused:`, richFieldRefusal(value));
    throw new Error("The content couldn't be read. Reload the page and try again.");
  }
  if (rich.empty) return { markdown: "", json: Prisma.DbNull };
  return { markdown: rich.markdown, json: rich.json as unknown as Prisma.InputJsonValue };
}
