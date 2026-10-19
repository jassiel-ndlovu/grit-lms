/**
 * Global search schemas — input for the header search action and the shape
 * of the grouped results it returns.
 */

import { z } from "zod";

export const SearchInputSchema = z.object({
  query: z.string().trim().max(100),
});

export type SearchHit = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchGroup = {
  /** Stable key — "courses", "lessons", "tests", … */
  key: string;
  label: string;
  hits: SearchHit[];
};
