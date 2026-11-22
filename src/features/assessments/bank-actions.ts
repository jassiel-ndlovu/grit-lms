"use server";

/**
 * Question bank actions (contracts/question-bank.md). Plus service
 * "question-bank", checked on the course the tutor is working in. Items
 * belong to the user who saved them, inside the course's workspace.
 */

import { z } from "zod";

import { hasService } from "@/features/billing/services";
import { getCourseScope } from "@/features/courses/course-access";
import { managesCourse } from "@/features/courses/lib/course-access";
import { staffFor } from "@/features/courses/lib/tenancy-where";
import { topicsToStore } from "@/features/courses/lib/curriculum";
import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";
import { getViewer } from "@/lib/viewer";

import {
  MAX_BANK_TREE, bankNodeCount, bankNodePoints, bankNodeTopics, bankStem, readBankNode,
} from "./lib/question-bank";
import { ImportQuestionSchema } from "./lib/test-io";

const NOT_ON_PLAN = "The question bank is part of the Plus plan for this course";

/** The course, when the user manages it and it has the bank. */
async function bankCourse(courseId: string, userId: string, email: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, workspaceId: true, subject: true, gradeLevel: true, staff: staffFor(email) },
  });
  if (!course || !course.workspaceId || !managesCourse(await getCourseScope(userId), course)) {
    throw new Error("Course not found");
  }
  const viewer = await getViewer();
  if (!viewer || !(await hasService(viewer, course.id, "question-bank"))) throw new Error(NOT_ON_PLAN);
  return { ...course, workspaceId: course.workspaceId };
}

export const saveQuestionToBank = tutorActionClient
  .schema(
    z.object({
      courseId: z.string().min(1).max(40),
      testId: z.string().max(40).nullable().optional(),
      question: ImportQuestionSchema,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const course = await bankCourse(parsedInput.courseId, ctx.session.user.id, ctx.session.user.email);
    const node = parsedInput.question;
    if (bankNodeCount(node) > MAX_BANK_TREE) throw new Error(`A bank question can hold at most ${MAX_BANK_TREE} parts`);
    const stem = bankStem(node);
    if (!stem && node.type !== "NONE") throw new Error("Write the question before saving it to the bank");
    const item = await prisma.bankQuestion.create({
      data: {
        workspaceId: course.workspaceId,
        ownerUserId: ctx.session.user.id,
        stem: stem || "Context",
        type: node.type,
        points: bankNodePoints(node),
        topics: topicsToStore(bankNodeTopics(node)),
        subject: course.subject,
        gradeLevel: course.gradeLevel,
        data: node as object,
        sourceTestId: parsedInput.testId ?? null,
      },
      select: { id: true },
    });
    return { id: item.id };
  });

export type BankListItem = {
  id: string;
  stem: string;
  type: string;
  points: number;
  parts: number;
  topics: string[];
  subject: string | null;
  gradeLevel: number | null;
  createdAt: string;
  /** The tree to copy into a test; null when it no longer reads. */
  data: z.infer<typeof ImportQuestionSchema> | null;
};

/** The user's bank items in the course's workspace, newest first. */
export const listBankQuestions = tutorActionClient
  .schema(
    z.object({
      courseId: z.string().min(1).max(40),
      topic: z.string().max(120).nullable().optional(),
      search: z.string().max(100).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ items: BankListItem[]; more: boolean }> => {
    const course = await bankCourse(parsedInput.courseId, ctx.session.user.id, ctx.session.user.email);
    const search = parsedInput.search?.trim();
    const take = 100;
    const rows = await prisma.bankQuestion.findMany({
      where: {
        workspaceId: course.workspaceId,
        ownerUserId: ctx.session.user.id,
        ...(parsedInput.topic ? { topics: { has: parsedInput.topic } } : {}),
        ...(search ? { stem: { contains: search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
    });
    return {
      more: rows.length > take,
      items: rows.slice(0, take).map((r) => {
        const data = readBankNode(r.data);
        return {
          id: r.id,
          stem: r.stem,
          type: r.type,
          points: r.points,
          parts: data ? bankNodeCount(data) : 1,
          topics: r.topics,
          subject: r.subject,
          gradeLevel: r.gradeLevel,
          createdAt: r.createdAt.toISOString(),
          data,
        };
      }),
    };
  });

/** Removes an item from the bank. Questions already copied into tests stay. */
export const deleteBankQuestion = tutorActionClient
  .schema(z.object({ id: z.string().min(1).max(40) }))
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.bankQuestion.deleteMany({
      where: { id: parsedInput.id, ownerUserId: ctx.session.user.id },
    });
    if (count === 0) throw new Error("That bank question is already gone");
    return { ok: true };
  });
