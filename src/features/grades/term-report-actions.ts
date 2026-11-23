"use server";

/**
 * Term report writes (contracts/term-reports.md). The owner and admins set
 * and release terms; whoever edits a course comments on its students.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { writableViewerActionClient } from "@/lib/safe-action";
import { UserError } from "@/lib/user-error";
import type { Viewer } from "@/lib/viewer";

import { COMMENT_MAX, reportRoutes, TERM_TITLE_MAX, termDaysError } from "./lib/term-report";
import { getTerm, isOnReport, reportStaff, studentReport, type ReportStaff } from "./term-reports";

const NO_ACCESS = "You don't have access to do that.";
const GONE = "That term is no longer there";

const id = z.string().min(1).max(40);
const title = z.string().trim().min(1, "Give the term a name").max(TERM_TITLE_MAX);
const day = z.string().max(10);
const comment = z.string().trim().max(COMMENT_MAX, `Keep it to ${COMMENT_MAX} characters`);

function staffOf(viewer: Viewer): ReportStaff {
  const staff = reportStaff(viewer);
  if (!staff) throw new UserError(NO_ACCESS);
  return staff;
}

function managerOf(viewer: Viewer): ReportStaff {
  const staff = staffOf(viewer);
  if (!staff.manages) throw new UserError(NO_ACCESS);
  return staff;
}

async function termOf(termId: string, staff: ReportStaff) {
  const term = await getTerm(termId, staff.workspaceId);
  if (!term) throw new UserError(GONE);
  return term;
}

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

function refresh() {
  revalidatePath(reportRoutes.home, "layout");
  revalidatePath("/dashboard/children", "layout");
  revalidatePath("/dashboard/grades");
}

export const saveReportTerm = writableViewerActionClient
  .schema(z.object({ id: id.optional(), title, startsOn: day, endsOn: day }))
  .action(async ({ parsedInput: p, ctx }) => {
    const staff = managerOf(ctx.viewer);
    const wrong = termDaysError(p.startsOn, p.endsOn);
    if (wrong) throw new UserError(wrong);
    const data = { title: p.title, startsOn: asDate(p.startsOn), endsOn: asDate(p.endsOn) };
    if (p.id) {
      const done = await prisma.reportTerm.updateMany({ where: { id: p.id, workspaceId: staff.workspaceId }, data });
      if (done.count === 0) throw new UserError(GONE);
      refresh();
      return { id: p.id };
    }
    const term = await prisma.reportTerm.create({
      data: { ...data, workspaceId: staff.workspaceId, createdByUserId: ctx.viewer.user.id },
      select: { id: true },
    });
    refresh();
    return term;
  });

export const releaseReportTerm = writableViewerActionClient
  .schema(z.object({ id, released: z.boolean() }))
  .action(async ({ parsedInput: p, ctx }) => {
    const staff = managerOf(ctx.viewer);
    const term = await termOf(p.id, staff);
    if (p.released !== (term.releasedAt !== null)) {
      await prisma.reportTerm.updateMany({
        where: { id: term.id, workspaceId: staff.workspaceId },
        data: { releasedAt: p.released ? new Date() : null },
      });
    }
    refresh();
    return { released: p.released };
  });

/** Deletes a term and its comments. A released one has to be taken back first. */
export const deleteReportTerm = writableViewerActionClient
  .schema(z.object({ id }))
  .action(async ({ parsedInput: p, ctx }) => {
    const staff = managerOf(ctx.viewer);
    const term = await termOf(p.id, staff);
    if (term.releasedAt) throw new UserError("Families can see this term. Take it back first.");
    const done = await prisma.reportTerm.deleteMany({ where: { id: term.id, workspaceId: staff.workspaceId, releasedAt: null } });
    if (done.count === 0) throw new UserError(GONE);
    refresh();
    return { deleted: true };
  });

/** A tutor's comment on one student's course. Empty deletes it. */
export const saveCourseComment = writableViewerActionClient
  .schema(z.object({ termId: id, learnerId: id, courseId: id, text: comment }))
  .action(async ({ parsedInput: p, ctx }) => {
    const staff = staffOf(ctx.viewer);
    const term = await termOf(p.termId, staff);
    const mine = staff.editWhere && (await prisma.course.count({ where: { AND: [{ id: p.courseId }, staff.editWhere] } })) > 0;
    if (!mine || !(await isOnReport(term, p.learnerId, p.courseId))) throw new UserError(NO_ACCESS);
    const key = { termId: term.id, learnerId: p.learnerId, courseId: p.courseId };
    if (p.text === "") await prisma.reportCourseComment.deleteMany({ where: key });
    else {
      const data = { text: p.text, authorUserId: ctx.viewer.user.id };
      await prisma.reportCourseComment.upsert({ where: { termId_learnerId_courseId: key }, create: { ...key, ...data }, update: data });
    }
    revalidatePath(reportRoutes.home, "layout");
    return { saved: true };
  });

/** The general comment. Empty deletes it. */
export const saveOverallComment = writableViewerActionClient
  .schema(z.object({ termId: id, learnerId: id, text: comment }))
  .action(async ({ parsedInput: p, ctx }) => {
    const staff = staffOf(ctx.viewer);
    const term = await termOf(p.termId, staff);
    const view = await studentReport(term, p.learnerId, staff);
    if (!view?.canEditOverall) throw new UserError(NO_ACCESS);
    const key = { termId: term.id, learnerId: p.learnerId };
    if (p.text === "") await prisma.reportOverallComment.deleteMany({ where: key });
    else {
      const data = { text: p.text, authorUserId: ctx.viewer.user.id };
      await prisma.reportOverallComment.upsert({ where: { termId_learnerId: key }, create: { ...key, ...data }, update: data });
    }
    revalidatePath(reportRoutes.home, "layout");
    return { saved: true };
  });
