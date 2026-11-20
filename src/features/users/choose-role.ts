"use server";

/**
 * The welcome page's role choice (owner decision 2026-11-20). A self
 * sign-up (email or Google) has no role until they pick one here, once:
 *
 *   TUTOR    staff; next they create a workspace in onboarding.
 *   STUDENT  a learner; a Student profile is made so a tutor can add them
 *            to courses. They see nothing until a tutor does.
 *   PARENT   a guardian; a tutor links them to their children.
 *
 * Preferences (dashboard tab, view, time zone, dark mode) are saved with
 * `updateOwnPreferences` from the same page. Accounts made by tutors or
 * admins are already confirmed and can't call this.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient } from "@/lib/safe-action";
import { ViewerError } from "@/lib/viewer";

import { chooseRoleFor } from "./choose-role-core";

const NEXT: Record<"TUTOR" | "STUDENT" | "PARENT", string> = {
  TUTOR: "/dashboard/onboarding",
  STUDENT: "/dashboard",
  PARENT: "/dashboard",
};

export const chooseAccountRole = viewerActionClient
  .schema(z.object({ role: z.enum(["TUTOR", "STUDENT", "PARENT"]) }))
  .action(async ({ parsedInput: { role }, ctx: { viewer } }) => {
    if (!(await chooseRoleFor(viewer.user.id, role))) throw new ViewerError("FORBIDDEN");
    revalidatePath("/", "layout");
    return { role, next: NEXT[role] };
  });
