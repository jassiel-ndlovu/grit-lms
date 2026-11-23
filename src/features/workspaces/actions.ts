"use server";

/**
 * Workspace actions (Agent A). Contract: docs/revamp/contracts/viewer.md.
 *
 * switchWorkspace accepts any workspace the viewer belongs to.
 * createWorkspace and updateWorkspaceProfile are onboarding (./onboarding.ts).
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertBillingEnabled } from "@/features/billing/errors";
import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { MEETING_PROVIDERS } from "@/lib/viewer-core";
import { requireViewer, ViewerError } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { createWorkspaceFor, updateWorkspaceProfileFor } from "./onboarding";
import { switchTeachingOffFor } from "./teaching";

// Not exported: a "use server" module may only export async functions.
const ACTIVE_WORKSPACE_COOKIE = "nexa_ws";

async function setActiveWorkspace(workspaceId: string) {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export const switchWorkspace = viewerActionClient
  .schema(z.object({ workspaceId: z.string().min(1) }))
  .action(async ({ parsedInput: { workspaceId }, ctx: { viewer } }) => {
    if (!viewer.workspaces.some((w) => w.id === workspaceId)) {
      throw new ViewerError("FORBIDDEN");
    }
    await setActiveWorkspace(workspaceId);
    return { workspaceId };
  });

/**
 * Organisation or tutor mode (#192), for an owner or admin of an
 * organisation who also teaches. A cookie, like the workspace switch.
 */
export const switchViewerMode = viewerActionClient
  .schema(z.object({ mode: z.enum(["organisation", "tutor"]) }))
  .action(async ({ parsedInput: { mode }, ctx: { viewer } }) => {
    if (viewer.mode === null) throw new ViewerError("FORBIDDEN");
    const store = await cookies();
    store.set("nexa_mode", mode, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
    return { mode };
  });

/**
 * Onboarding "Solo or Organisation" (ux/01, section 3): creates the
 * workspace with the caller as OWNER, starts the 14-day trial, and makes it
 * the active workspace. Needs a verified email. Behind BILLING=1, since the
 * trial is part of billing.
 */
export const createWorkspace = viewerActionClient
  .schema(z.object({
    kind: z.enum(["SOLO", "ORGANISATION"]),
    name: z.string().trim().min(2).max(80).optional(),
    timezone: z.string().min(1).max(64).optional(),
    /** false skips the trial: the workspace stays read-only until the first payment. */
    trial: z.boolean().optional(),
  }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    assertBillingEnabled();
    const r = await createWorkspaceFor(
      { id: viewer.user.id, name: viewer.user.name, email: viewer.user.email, emailVerified: viewer.user.emailVerified },
      parsedInput,
    );
    await setActiveWorkspace(r.workspaceId);
    return r;
  });

/** Onboarding step 1 and workspace settings: name and time zone. Needs `workspace.settings`. */
export const updateWorkspaceProfile = viewerActionClient
  .schema(z.object({ name: z.string().max(80).optional(), timezone: z.string().min(1).max(64).optional() }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer({ workspace: true });
    if (!can(viewer, "workspace.settings")) throw new ViewerError("FORBIDDEN");
    const r = await updateWorkspaceProfileFor(viewer.user.id, viewer.workspace!.id, parsedInput);
    revalidatePath("/", "layout");
    return r;
  });

/**
 * Switches teaching off for the active organisation (#206). Owner only;
 * `confirmName` must be the organisation's name. Strict: only a Nexa admin
 * switches it back on (adminSwitchTeachingOn). Refused with a message
 * while an owner or admin still teaches a course.
 */
export const switchTeachingOff = writableViewerActionClient
  .schema(z.object({ confirmName: z.string().trim().min(1).max(120) }))
  .action(async ({ parsedInput: { confirmName }, ctx: { viewer } }) => {
    if (!viewer.workspace || viewer.membership?.role !== "OWNER" || viewer.workspace.kind !== "ORGANISATION") throw new ViewerError("FORBIDDEN");
    const r = await switchTeachingOffFor(viewer.workspace.id, viewer.user.id, confirmName);
    revalidatePath("/", "layout");
    return r;
  });

/**
 * The workspace's default meeting service for new sessions (#211).
 * Owners and admins (workspace.settings); refused in a read-only workspace.
 */
export const setMeetingProvider = writableViewerActionClient
  .schema(z.object({ meetingProvider: z.enum(MEETING_PROVIDERS) }))
  .action(async ({ parsedInput: { meetingProvider }, ctx: { viewer } }) => {
    if (!viewer.workspace || !can(viewer, "workspace.settings")) throw new ViewerError("FORBIDDEN");
    await prisma.$transaction([
      prisma.workspace.update({ where: { id: viewer.workspace.id }, data: { meetingProvider } }),
      prisma.auditLog.create({ data: { workspaceId: viewer.workspace.id, actorUserId: viewer.user.id, action: "workspace.meeting_provider", targetType: "Workspace", targetId: viewer.workspace.id, data: { meetingProvider } } }),
    ]);
    revalidatePath("/", "layout");
    return { meetingProvider };
  });
