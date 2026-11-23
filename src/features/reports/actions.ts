"use server";

/**
 * The business dashboard for B's screens (#216 phase 1). Plus and Pro
 * only; needs `reports.view` (owners, admins, executives, finance, branch
 * and project managers). A branch role sees its branches. Contract:
 * billing.md, "Business dashboard".
 */

import { z } from "zod";

import { viewerActionClient } from "@/lib/safe-action";
import { UserError } from "@/lib/user-error";
import { ViewerError } from "@/lib/viewer";
import { can, staffScope, type Viewer } from "@/lib/viewer-core";

import { businessDashboardAvailable, businessDashboardFor, type DashboardScope } from "./business";

function scopeOf(viewer: Viewer): DashboardScope {
  const s = staffScope(viewer);
  if (s === "WORKSPACE") return null;
  return { membershipId: viewer.membership!.id, branchIds: s === "BRANCHES" ? (viewer.membership?.branchIds ?? []) : [] };
}

/** For the nav: whether to show the dashboard, and why not. */
export const getBusinessDashboardStatus = viewerActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { viewer } }) => {
    const canView = !!viewer.workspace && viewer.persona === "staff" && can(viewer, "reports.view");
    return { canView, available: canView ? await businessDashboardAvailable(viewer.workspace!.id) : false };
  });

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Must be a date");

export const getBusinessDashboard = viewerActionClient
  .schema(z.object({ from: iso.optional(), to: iso.optional() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "reports.view")) throw new ViewerError("FORBIDDEN");
    if (!(await businessDashboardAvailable(viewer.workspace.id))) throw new UserError("The business dashboard is part of the Plus and Pro plans.");
    const from = parsedInput.from ? new Date(parsedInput.from) : undefined;
    const to = parsedInput.to ? new Date(parsedInput.to) : undefined;
    if (from && to && (to <= from || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000)) throw new UserError("Choose a range of up to a year.");
    return businessDashboardFor(viewer.workspace.id, scopeOf(viewer), { from, to });
  });
