/**
 * Typed Server Action clients built on next-safe-action.
 *
 * Clients exported:
 *   - actionClient        — public, no auth required
 *   - authActionClient    — requires a logged-in user (any role)
 *   - tutorActionClient   — requires role === "TUTOR"
 *   - studentActionClient — requires role === "STUDENT"
 *   - adminActionClient   — requires role === "ADMIN"
 *   - parentActionClient  — requires role === "PARENT"
 *   - staffActionClient   — requires role "TUTOR" or "ADMIN"
 *   - viewerActionClient  — any logged-in user; adds `ctx.viewer`
 *   - guardianActionClient — persona "guardian"; adds `ctx.viewer`
 *
 * staff and admin clients also add `ctx.viewer` (getViewer(), see
 * docs/revamp/contracts/viewer.md). New code should check permissions with
 * `can(ctx.viewer, ...)` / `canIn(...)` rather than the session role.
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
import { getViewer, requireViewer, ViewerError } from "@/lib/viewer";
import { UserError } from "@/lib/user-error";
import { BillingError } from "@/features/billing/errors";
import { ProviderError } from "@/features/payments/provider/types";

/**
 * Base client — no auth. Use for actions that should be callable by anyone
 * (e.g. password reset request).
 */
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof AuthError) {
      return e.message;
    }
    // Stable codes from docs/revamp/contracts/billing.md ("CODE: message").
    if (e instanceof BillingError) {
      return `${e.code}: ${e.message}`;
    }
    // The payment service's own message names it and is technical: log it,
    // and tell people what it means for them (docs/revamp/copy.md).
    if (e instanceof ProviderError) {
      console.error("[safe-action] payment service error:", e.message);
      return `${e.code}: We couldn't reach the payment service. Nothing was charged. Try again in a minute.`;
    }
    // Messages written for the user (UserError and its subclasses).
    if (e instanceof UserError) {
      return e.message;
    }
    if (e instanceof ViewerError) {
      return e.code === "UNAUTHENTICATED" ? "Please sign in again." : "You don't have access to do that.";
    }
    // Don't leak internal errors to the client; log server-side instead.
    console.error("[safe-action] unexpected error:", e);
    return "That didn't work, and it isn't something you did. Try again in a minute. If it keeps happening, report it from Help.";
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
/**
 * Staff writes are refused in a read-only workspace (#189): one guard here
 * for every action on the tutor and staff clients. Billing, fees and
 * exports use other clients, so they keep working.
 */
async function assertWritable() {
  const viewer = await getViewer();
  if (viewer?.persona === "staff" && viewer.workspace?.readOnly) {
    throw new BillingError("READ_ONLY", "Your organisation is locked until it's paid for. Everyone can still see their work, but nothing can be changed. Pay from Billing to unlock it.");
  }
}

/** Tutor reads and exports that stay allowed in a read-only workspace. */
export const tutorReadActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("TUTOR");
  return next({ ctx: { session } });
});

export const tutorActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("TUTOR");
  await assertWritable();
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
 * Admin-only client — adds `ctx.session` with role asserted to "ADMIN".
 */
export const adminActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("ADMIN");
  const viewer = await requireViewer({ persona: "admin" });
  return next({ ctx: { session, viewer } });
});

/**
 * Parent-only client — adds `ctx.session` with role asserted to "PARENT".
 */
export const parentActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("PARENT");
  return next({ ctx: { session } });
});

/**
 * Staff client — tutors and admins (e.g. account provisioning).
 */
export const staffActionClient = actionClient.use(async ({ next }) => {
  const session = await requireRole("TUTOR", "ADMIN");
  const viewer = await requireViewer();
  await assertWritable();
  return next({ ctx: { session, viewer } });
});

/**
 * Any logged-in user, with the viewer resolved. Adds `ctx.session` and
 * `ctx.viewer`. Check permissions inside the action with can() / canIn().
 */
export const viewerActionClient = actionClient.use(async ({ next }) => {
  const session = await requireSession();
  const viewer = await requireViewer();
  return next({ ctx: { session, viewer } });
});

/**
 * viewerActionClient for writes: also refused for staff in a read-only
 * workspace (#189, #150), like the tutor and staff clients.
 */
export const writableViewerActionClient = viewerActionClient.use(async ({ next }) => {
  await assertWritable();
  return next();
});

/**
 * Parents and guardians (persona "guardian"). Adds `ctx.viewer`.
 */
export const guardianActionClient = actionClient.use(async ({ next }) => {
  const session = await requireSession();
  const viewer = await requireViewer({ persona: "guardian" });
  return next({ ctx: { session, viewer } });
});

/**
 * Helper for use INSIDE actions when an action is shared between roles but
 * one branch needs the session. Prefer the role-specific client over this.
 */
export { auth, requireSession, requireRole };
