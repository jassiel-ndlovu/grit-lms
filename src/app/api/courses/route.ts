/**
 * /api/courses: retired. Courses are read through
 * `src/features/courses/queries.ts` and created by its Server Actions.
 *
 * TODO[chapter-3-cleanup]: drop this file.
 */

import { gone } from "@/lib/api-guard";

export function GET() {
  return gone("Read courses through src/features/courses/queries.ts.");
}
