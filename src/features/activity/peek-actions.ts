"use server";

/**
 * What the peek panel shows for one student on the Students page. The same
 * check as the student's page (learners.invite, and the viewer's own
 * students); marks and alerts only with grades.view, on the courses that
 * permission covers.
 */

import { z } from "zod";

import { getRosterStudent } from "@/features/courses/lib/roster";
import { prisma } from "@/lib/db";
import { viewerActionClient } from "@/lib/safe-action";
import { can } from "@/lib/viewer";
import { courseScopeOf, scopedCourseWhere } from "@/lib/viewer-core";

import { alertRows, seesAlerts } from "./at-risk";
import { LEVEL_CHIP } from "./lib/at-risk";

export interface StudentPeek {
  username: string | null;
  email: string | null;
  isMinor: boolean;
  awaitingFirstSignIn: boolean;
  deleteOn: string | null;
  courses: Array<{ id: string; name: string }>;
  /** Null when the viewer doesn't see grades. */
  marks: Array<{ id: string; title: string; course: string; score: number; outOf: number; at: string }> | null;
  alerts: Array<{ id: string; course: string; level: string; tone: "danger" | "warning"; summary: string }>;
}

const MARKS = 5;

export const peekStudent = viewerActionClient
  .schema(z.object({ learnerId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }): Promise<StudentPeek | null> => {
    const { viewer } = ctx;
    if (viewer.persona !== "staff" || !viewer.workspace || !can(viewer, "learners.invite")) return null;
    const student = await getRosterStudent(viewer, parsedInput.learnerId);
    if (!student) return null;

    const sees = seesAlerts(viewer);
    const scope = courseScopeOf(viewer, "grades.view");
    const [marks, alerts] = sees
      ? await Promise.all([
          prisma.grade.findMany({
            where: {
              student: { userId: student.userId },
              course: { workspaceId: viewer.workspace.id, ...(scope ? scopedCourseWhere(scope) : {}) },
            },
            select: { id: true, title: true, score: true, outOf: true, updatedAt: true, course: { select: { name: true } } },
            orderBy: { updatedAt: "desc" },
            take: MARKS,
          }),
          alertRows(viewer, "open").then((rows) => rows.filter((a) => a.student.userId === student.userId)),
        ])
      : [null, []];

    return {
      username: student.username,
      email: student.email,
      isMinor: student.isMinor,
      awaitingFirstSignIn: student.awaitingFirstSignIn,
      deleteOn: student.deleteOn,
      courses: student.courses,
      marks: marks?.map((g) => ({ id: g.id, title: g.title, course: g.course.name, score: g.score, outOf: g.outOf, at: g.updatedAt.toISOString() })) ?? null,
      alerts: alerts.map((a) => ({
        id: a.id, course: a.course.name, level: LEVEL_CHIP[a.level].label, tone: a.level === "AT_RISK" ? "danger" : "warning", summary: a.summary,
      })),
    };
  });
