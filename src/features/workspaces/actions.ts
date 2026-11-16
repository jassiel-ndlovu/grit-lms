"use server";

/**
 * Workspace actions (Agent A). Contract: docs/revamp/contracts/viewer.md.
 *
 * Phase 0: there is one workspace (LEGACY_WORKSPACE), so switching only
 * accepts its id. The cookie is already written so the switcher UI and its
 * links work unchanged when Phase 1 adds real workspaces.
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";

// Not exported: a "use server" module may only export async functions.
const ACTIVE_WORKSPACE_COOKIE = "nexa_ws";

export const switchWorkspace = viewerActionClient
  .schema(z.object({ workspaceId: z.string().min(1) }))
  .action(async ({ parsedInput: { workspaceId }, ctx: { viewer } }) => {
    if (!viewer.workspaces.some((w) => w.id === workspaceId)) {
      throw new ViewerError("FORBIDDEN");
    }
    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/", "layout");
    return { workspaceId };
  });
