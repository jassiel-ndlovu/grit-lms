"use server";

/**
 * What the peek panel shows for one script on a test's Submissions page.
 * The same check as the marking page: the test must be the tutor's.
 */

import { z } from "zod";

import { getCourseScope } from "@/features/courses/course-access";
import { prisma } from "@/lib/db";
import { formatLabel, normalizeScheme } from "@/lib/enum-labels";
import { tutorReadActionClient } from "@/lib/safe-action";

import { plainPreview } from "./lib/ai-marking-ui";
import { getTestDetailById, testBelongsToTutor } from "./queries";

export interface ScriptPeek {
  status: "GRADED" | "SUBMITTED" | "IN_PROGRESS";
  email: string;
  startedAt: string;
  submittedAt: string | null;
  grade: { score: number; outOf: number; comments: string | null } | null;
  files: number;
  questions: Array<{ id: string; label: string; preview: string; points: number; answered: boolean; score: number | null }>;
}

const hasAnswer = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0);

export const peekScript = tutorReadActionClient
  .schema(z.object({ submissionId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }): Promise<ScriptPeek | null> => {
    const sub = await prisma.testSubmission.findUnique({
      where: { id: parsedInput.submissionId },
      select: {
        testId: true, status: true, startedAt: true, submittedAt: true, answers: true,
        student: { select: { email: true } },
        grade: { select: { score: true, outOf: true, finalComments: true } },
        questionGrades: { select: { questionId: true, score: true } },
        _count: { select: { uploadedFiles: true } },
      },
    });
    if (!sub) return null;
    const scope = await getCourseScope(ctx.session.user.id);
    if (!(await testBelongsToTutor(sub.testId, scope))) return null;
    const test = await getTestDetailById(sub.testId);
    if (!test) return null;

    const answers = sub.answers && typeof sub.answers === "object" && !Array.isArray(sub.answers) ? (sub.answers as Record<string, unknown>) : {};
    const scoreOf = new Map(sub.questionGrades.map((g) => [g.questionId, g.score]));
    const scheme = normalizeScheme(test.labelScheme);
    const questions: ScriptPeek["questions"] = [];
    const visit = (parent: string | null, path: number[]) =>
      test.questions
        .filter((q) => (q.parentId ?? null) === parent)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())
        .forEach((q, i) => {
          const pos = [...path, i];
          if (q.type !== "NONE") {
            questions.push({
              id: q.id, label: formatLabel(scheme, pos), preview: plainPreview(q.question, 70), points: q.points,
              answered: hasAnswer(answers[q.id]), score: scoreOf.get(q.id) ?? null,
            });
          }
          visit(q.id, pos);
        });
    visit(null, []);

    return {
      status: sub.status === "GRADED" ? "GRADED" : sub.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
      email: sub.student.email,
      startedAt: sub.startedAt.toISOString(),
      submittedAt: sub.submittedAt?.toISOString() ?? null,
      grade: sub.grade ? { score: sub.grade.score, outOf: sub.grade.outOf, comments: sub.grade.finalComments } : null,
      files: sub._count.uploadedFiles,
      questions,
    };
  });
