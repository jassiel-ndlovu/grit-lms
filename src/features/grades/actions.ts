/**
 * Gradebook Server Actions.
 *
 * Only one write lives here: setting the weights on a course's assessments.
 * Grades themselves are still written by the two grading actions
 * (gradeTestSubmission / gradeEntryWithSections) — see the note at the top
 * of features/grades/queries.ts.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";

import { CuidSchema } from "../shared/primitives";
import { courseBelongsToTutor, parseAssessmentKey } from "./gradebook";

export const SetAssessmentWeightsSchema = z.object({
  courseId: CuidSchema,
  weights: z
    .array(
      z.object({
        /** Namespaced key: `test:<id>` or `assignment:<id>`. */
        key: z.string().min(3),
        /** Percentage share, or null to fall back to weighting by points. */
        weight: z.number().min(0).max(100).nullable(),
      }),
    )
    .max(200),
});

export const setAssessmentWeights = tutorActionClient
  .schema(SetAssessmentWeightsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const tutor = await prisma.tutor.findUnique({
      where: { email: ctx.session.user.email },
      select: { id: true },
    });
    if (!tutor) throw new Error("Tutor profile not found");

    const owns = await courseBelongsToTutor(parsedInput.courseId, tutor.id);
    if (!owns) throw new Error("You don't own this course");

    const tests: Array<{ id: string; weight: number | null }> = [];
    const assignments: Array<{ id: string; weight: number | null }> = [];

    for (const row of parsedInput.weights) {
      const parsed = parseAssessmentKey(row.key);
      if (!parsed) throw new Error(`Unrecognised assessment: ${row.key}`);
      (parsed.kind === "test" ? tests : assignments).push({
        id: parsed.id,
        weight: row.weight,
      });
    }

    // Scope every update to this course as well as the row id, so a forged
    // key can't reach an assessment in somebody else's course.
    await prisma.$transaction([
      ...tests.map((t) =>
        prisma.test.updateMany({
          where: { id: t.id, courseId: parsedInput.courseId },
          data: { weight: t.weight },
        }),
      ),
      ...assignments.map((s) =>
        prisma.submission.updateMany({
          where: { id: s.id, courseId: parsedInput.courseId },
          data: { weight: s.weight },
        }),
      ),
    ]);

    revalidatePath(`/dashboard/gradebook/${parsedInput.courseId}`);
    revalidatePath("/dashboard/gradebook");
    revalidatePath("/dashboard/analytics");

    return { updated: tests.length + assignments.length };
  });
