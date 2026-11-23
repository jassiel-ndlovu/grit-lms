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
import { courseAccessSelect } from "@/features/courses/lib/tenancy-where";
import { topicsToStore } from "@/features/courses/lib/curriculum";
import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";
import { UserError } from "@/lib/user-error";
import { getViewer } from "@/lib/viewer";

import {
  MAX_BANK_TREE, MAX_DRAW_COUNT, MAX_DRAW_ROWS, bankNodeCount, bankNodePoints, bankNodeTopics, bankStem, drawFromPool,
  readBankNode, topicCounts, type DrawShort,
} from "./lib/question-bank";
import { ImportQuestionSchema } from "./lib/test-io";

const NOT_ON_PLAN = "The question bank is part of the Plus plan for this course";

/** The course, when the user manages it and it has the bank. */
async function bankCourse(courseId: string, userId: string, email: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, subject: true, gradeLevel: true, ...courseAccessSelect(email) },
  });
  if (!course || !course.workspaceId || !managesCourse(await getCourseScope(userId), course)) {
    throw new UserError("Course not found");
  }
  const viewer = await getViewer();
  if (!viewer || !(await hasService(viewer, course.id, "question-bank"))) throw new UserError(NOT_ON_PLAN);
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
    if (bankNodeCount(node) > MAX_BANK_TREE) throw new UserError(`A bank question can hold at most ${MAX_BANK_TREE} parts`);
    const stem = bankStem(node);
    if (!stem && node.type !== "NONE") throw new UserError("Write the question before saving it to the bank");
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

type BankRow = Awaited<ReturnType<typeof prisma.bankQuestion.findMany>>[number];

function toListItem(r: BankRow): BankListItem {
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
}

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
      items: rows.slice(0, take).map(toListItem),
    };
  });

/** Removes an item from the bank. Questions already copied into tests stay. */
export const deleteBankQuestion = tutorActionClient
  .schema(z.object({ id: z.string().min(1).max(40) }))
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.bankQuestion.deleteMany({
      where: { id: parsedInput.id, ownerUserId: ctx.session.user.id },
    });
    if (count === 0) throw new UserError("That bank question is already gone");
    return { ok: true };
  });

/** Bank items per topic, for "Generate from bank". */
export const bankTopicCounts = tutorActionClient
  .schema(z.object({ courseId: z.string().min(1).max(40) }))
  .action(async ({ parsedInput, ctx }) => {
    const course = await bankCourse(parsedInput.courseId, ctx.session.user.id, ctx.session.user.email);
    const rows = await prisma.bankQuestion.findMany({
      where: { workspaceId: course.workspaceId, ownerUserId: ctx.session.user.id },
      select: { topics: true },
    });
    return { counts: topicCounts(rows) };
  });

/**
 * "Generate from bank": a random draw by topic. Returns copies to add to
 * the test being edited; every student then sits the same questions.
 */
export const drawBankQuestions = tutorActionClient
  .schema(
    z.object({
      courseId: z.string().min(1).max(40),
      picks: z
        .array(z.object({ topic: z.string().min(1).max(120), count: z.number().int().min(1).max(MAX_DRAW_COUNT) }))
        .min(1)
        .max(MAX_DRAW_ROWS),
      /** Bank items already in the test, so the draw skips them. */
      exclude: z.array(z.string().max(40)).max(500).default([]),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ items: BankListItem[]; short: DrawShort[] }> => {
    const course = await bankCourse(parsedInput.courseId, ctx.session.user.id, ctx.session.user.email);
    const topics = [...new Set(parsedInput.picks.map((p) => p.topic))];
    const rows = await prisma.bankQuestion.findMany({
      where: {
        workspaceId: course.workspaceId,
        ownerUserId: ctx.session.user.id,
        topics: { hasSome: topics },
        ...(parsedInput.exclude.length ? { id: { notIn: parsedInput.exclude } } : {}),
      },
      take: 5000,
    });
    // Unreadable items can't be copied, so they never enter the draw.
    const pool = rows.map(toListItem).filter((i) => i.data);
    const { drawn, short } = drawFromPool(pool, parsedInput.picks);
    return { items: drawn, short };
  });
