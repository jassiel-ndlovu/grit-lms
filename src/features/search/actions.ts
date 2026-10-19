/**
 * Global search Server Action — called as the user types in the header.
 *
 * Read-only, but a Server Action rather than an RSC query because the
 * input changes on every keystroke. Scoping (enrolment / ownership) lives
 * in ./queries.ts.
 */

"use server";

import { authActionClient } from "@/lib/safe-action";

import { searchForUser } from "./queries";
import { SearchInputSchema } from "./schemas";

export const searchEverything = authActionClient
  .schema(SearchInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    return { groups: await searchForUser(ctx.session, parsedInput.query) };
  });
