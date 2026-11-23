"use server";

/**
 * At-risk alerts (#216 phase 2, Pro). Contract: viewer.md, "At-risk alerts".
 *
 *   listRiskAlerts           staff, grades.view (scoped)
 *   countRiskAlerts          staff: open alerts per course
 *   shareRiskAlertAction     staff, grades.view and messages.direct on the course; Pro
 *   dismissRiskAlertAction   staff, grades.view
 *   resolveRiskAlertAction   staff, grades.view
 *   listMySharedRiskAlerts   students and parents
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import { ViewerError, type Viewer } from "@/lib/viewer";

import { countOpenRiskAlerts, dismissRiskAlert, listRiskAlertsFor, listSharedRiskAlerts, resolveRiskAlert, shareRiskAlert } from "./alerts";

const id = z.string().min(1).max(64);

function staff(ctx: unknown): Viewer {
  const v = (ctx as { viewer: Viewer }).viewer;
  if (v.persona !== "staff" && v.persona !== "admin") throw new ViewerError("FORBIDDEN");
  if (!v.permissions.includes("grades.view")) throw new ViewerError("FORBIDDEN");
  return v;
}

function done<T>(r: T): T {
  revalidatePath("/dashboard", "layout");
  return r;
}

export const listRiskAlerts = viewerActionClient
  .schema(z.object({ courseId: id.optional(), status: z.enum(["open", "closed", "all"]).optional(), limit: z.number().int().min(1).max(200).optional() }))
  .action(async ({ parsedInput, ctx }) => listRiskAlertsFor(staff(ctx), parsedInput));

export const countRiskAlerts = viewerActionClient.schema(z.object({})).action(async ({ ctx }) => countOpenRiskAlerts(staff(ctx)));

export const shareRiskAlertAction = writableViewerActionClient
  .schema(z.object({ alertId: id, withGuardians: z.boolean(), withStudent: z.boolean(), note: z.string().max(1000).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await shareRiskAlert(staff(ctx), parsedInput)));

export const dismissRiskAlertAction = writableViewerActionClient
  .schema(z.object({ alertId: id }))
  .action(async ({ parsedInput, ctx }) => done(await dismissRiskAlert(staff(ctx), parsedInput)));

export const resolveRiskAlertAction = writableViewerActionClient
  .schema(z.object({ alertId: id }))
  .action(async ({ parsedInput, ctx }) => done(await resolveRiskAlert(staff(ctx), parsedInput)));

export const listMySharedRiskAlerts = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx }) => listSharedRiskAlerts((ctx as { viewer: Viewer }).viewer));
