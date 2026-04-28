/**
 * Typed Server Action clients built on next-safe-action.
 *
 * Three clients are exported:
 *   - actionClient        — public, no auth required
 *   - authActionClient    — requires a logged-in user (any role)
 *   - tutorActionClient   — requires role === "TUTOR"
 *   - studentActionClient — requires role === "STUDENT"
 *
 * Each client validates input with a Zod schema, runs middleware to attach
 * session context, and returns a typed result the form/page can consume.
 *
 * Usage:
 *
 *   export const createCourse = tutorActionClient
 *     .schema(CreateCourseSchema)
 *     .action(async ({ parsedInput, ctx }) => {
 *       // ctx.session is guaranteed
 *       // parsedInput is typed per the schema
 *     });
 */

import { createSafeActionClient } from "next-safe-action";

import { auth, AuthError, requireRole, requireSession } from "@/lib/auth";

/**
 * Base client — no auth. Use for actions that should be callable by anyone
 * (e.g. password reset request).
 */
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof AuthError) {
      return e.message;
    }
    // Don't leak internal errors to the client; log server-side instead.
    console.error("[safe-action] unexpected error:", e);
    return "Something went wrong. Please try again.";
  },
});

/**
 * Authenticated client — any logged-in user. Adds `ctx.session`.
 */
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await requireSession();
  return next({ ctx: { session } });
});

/**
 * Tutor-only client — adds `ctx.session` with role asserted to "TUTOR".
 */
export const tutorActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("TUTOR");
  return next({ ctx: { session } });
});

/**
 * Student-only client — adds `ctx.session` with role asserted to "STUDENT".
 */
export const studentActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("STUDENT");
  return next({ ctx: { session } });
});

/**
 * Helper for use INSIDE actions when an action is shared between roles but
 * one branch needs the session. Prefer the role-specific client over this.
 */
export { auth, requireSession, requireRole };
