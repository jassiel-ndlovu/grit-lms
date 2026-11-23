"use server";

/** Staff invites (design 02, section 5; ux/01, section 5). Inviting and revoking need `members.invite`. */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionClient, viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { requireViewer, ViewerError } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { acceptInviteFor, createStaffInvitesFor, inviteSummaryFor, listInvitesFor, revokeInviteFor } from "./invites";

async function inviter() {
  const viewer = await requireViewer({ workspace: true });
  if (!can(viewer, "members.invite")) throw new ViewerError("FORBIDDEN");
  return { viewer, workspaceId: viewer.workspace!.id };
}

/** Invites by email (up to 50). Returns per address: INVITED, RESENT (a pending invite got a new link) or ALREADY_MEMBER. */
export const inviteStaff = writableViewerActionClient
  .schema(z.object({ emails: z.array(z.string().trim().email()).min(1).max(50), role: z.enum(["ADMIN", "TUTOR"]), courseIds: z.array(z.string().min(1)).max(50).optional() }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await inviter();
    if (parsedInput.role === "ADMIN" && viewer.membership?.role !== "OWNER" && viewer.persona !== "admin") throw new ViewerError("FORBIDDEN");
    const r = await createStaffInvitesFor({ userId: viewer.user.id, name: viewer.user.name }, workspaceId, parsedInput);
    revalidatePath("/dashboard", "layout");
    return r;
  });

export const listInvites = viewerActionClient
  .schema(z.object({}))
  .action(async () => {
    const { workspaceId } = await inviter();
    return listInvitesFor(workspaceId);
  });

export const revokeInvite = writableViewerActionClient
  .schema(z.object({ inviteId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const { viewer, workspaceId } = await inviter();
    const r = await revokeInviteFor(viewer.user.id, workspaceId, parsedInput.inviteId);
    revalidatePath("/dashboard", "layout");
    return r;
  });

/** For /auth/invite/[token] (works signed out): { state, workspaceName, workspaceLogoUrl, role, invitedBy, expiresAt, emailMasked } or null. */
export const getInvite = actionClient
  .schema(z.object({ token: z.string().min(10).max(200) }))
  .action(async ({ parsedInput }) => inviteSummaryFor(parsedInput.token));

/** Accepts for the signed-in user. { ok: true, workspaceId } or { ok: false, reason: INVALID | EXPIRED | ACCEPTED | REVOKED | WRONG_ACCOUNT }. */
export const acceptInvite = viewerActionClient
  .schema(z.object({ token: z.string().min(10).max(200) }))
  .action(async ({ parsedInput }) => {
    const viewer = await requireViewer();
    const r = await acceptInviteFor({ id: viewer.user.id, email: viewer.user.email }, parsedInput.token);
    if (r.ok) revalidatePath("/", "layout");
    return r;
  });
