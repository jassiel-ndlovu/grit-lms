"use server";

/**
 * Timesheets, pay rates and cover (#216 phase 3, organisations). Contract:
 * viewer.md, "Timesheets and cover". Tutors act on their own; managers with
 * timesheets.manage or cover.manage on the staff in their scope. Payroll
 * CSV: GET /api/exports/payroll?month=YYYY-MM[&detail=1].
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { viewerActionClient, writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import * as cover from "./cover";
import * as ts from "./timesheets";

const id = z.string().min(1).max(64);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const v = (ctx: unknown) => (ctx as { viewer: Viewer }).viewer;
function done<T>(r: T): T {
  revalidatePath("/dashboard", "layout");
  return r;
}

export const getTimesheetAction = viewerActionClient
  .schema(z.object({ month, membershipId: id.optional() }))
  .action(async ({ parsedInput, ctx }) => ts.getTimesheet(v(ctx), parsedInput));

export const addTimesheetSuggestionsAction = writableViewerActionClient
  .schema(z.object({ timesheetId: id, keys: z.array(z.string().max(120)).max(500).optional() }))
  .action(async ({ parsedInput, ctx }) => done(await ts.addSuggestions(v(ctx), parsedInput)));

export const addTimesheetEntryAction = writableViewerActionClient
  .schema(z.object({ timesheetId: id, startsAt: z.coerce.date(), minutes: z.number().int(), label: z.string().min(1).max(200), courseId: id.nullable().optional(), note: z.string().max(300).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await ts.addManualEntry(v(ctx), parsedInput)));

export const updateTimesheetEntryAction = writableViewerActionClient
  .schema(z.object({ entryId: id, minutes: z.number().int().optional(), note: z.string().max(300).nullable().optional(), label: z.string().max(200).optional() }))
  .action(async ({ parsedInput, ctx }) => done(await ts.updateEntry(v(ctx), parsedInput)));

export const removeTimesheetEntryAction = writableViewerActionClient
  .schema(z.object({ entryId: id }))
  .action(async ({ parsedInput, ctx }) => done(await ts.removeEntry(v(ctx), parsedInput)));

export const submitTimesheetAction = writableViewerActionClient
  .schema(z.object({ timesheetId: id }))
  .action(async ({ parsedInput, ctx }) => done(await ts.submitTimesheet(v(ctx), parsedInput)));

export const decideTimesheetAction = writableViewerActionClient
  .schema(z.object({ timesheetId: id, decision: z.enum(["APPROVED", "REJECTED", "DRAFT"]), note: z.string().max(500).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await ts.decideTimesheet(v(ctx), parsedInput)));

export const setPayRateAction = writableViewerActionClient
  .schema(z.object({ membershipId: id, hourlyCents: z.number().int() }))
  .action(async ({ parsedInput, ctx }) => done(await ts.setPayRate(v(ctx), parsedInput)));

export const listTimesheetsAction = viewerActionClient
  .schema(z.object({ month, status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional() }))
  .action(async ({ parsedInput, ctx }) => ts.listTimesheets(v(ctx), parsedInput));

export const requestCoverAction = writableViewerActionClient
  .schema(z.object({ eventId: id, occurrenceStart: z.coerce.date(), absentMembershipId: id.optional(), reason: z.string().max(300).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => done(await cover.requestCover(v(ctx), parsedInput)));

export const coverCandidatesAction = viewerActionClient
  .schema(z.object({ coverId: id }))
  .action(async ({ parsedInput, ctx }) => cover.coverCandidates(v(ctx), parsedInput));

export const assignCoverAction = writableViewerActionClient
  .schema(z.object({ coverId: id, coverMembershipId: id }))
  .action(async ({ parsedInput, ctx }) => done(await cover.assignCover(v(ctx), parsedInput)));

export const cancelCoverAction = writableViewerActionClient
  .schema(z.object({ coverId: id }))
  .action(async ({ parsedInput, ctx }) => done(await cover.cancelCover(v(ctx), parsedInput)));

export const listCoverAction = viewerActionClient
  .schema(z.object({ from: z.coerce.date(), to: z.coerce.date(), status: z.enum(["OPEN", "ASSIGNED", "CANCELLED"]).optional() }))
  .action(async ({ parsedInput, ctx }) => cover.listCover(v(ctx), parsedInput));
