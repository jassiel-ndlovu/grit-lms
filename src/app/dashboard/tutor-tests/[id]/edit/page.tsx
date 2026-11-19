/**
 * /dashboard/tutor-tests/[id]/edit — tutor edits an existing test.
 *
 * Server Component. Verifies ownership, loads the test tree, converts it
 * into the EditorQuestion shape the form expects (client-side clientIds
 * generated as `id:${dbId}` so React keys stay stable during editing),
 * then renders <TestForm> in edit mode.
 */

import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { listCoursesByTutorId } from "@/features/courses/queries";
import {
  getTestDetailById,
  testBelongsToTutor,
  type TestDetail,
} from "@/features/assessments/queries";
import { TestForm } from "@/features/assessments/components/test-form";
import { loadTestFingerprint } from "@/features/assessments/lib/test-fingerprint";
import { ExportTestButton } from "@/features/assessments/components/export-test-button";
import { TestFrame } from "@/features/assessments/components/test-frame";
import type {
  EditorQuestion,
  EditorQuestionType,
} from "@/features/assessments/components/test-question-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Edit test" };

/** Build the editor tree from Prisma's flat questions payload. */
function buildEditorTree(all: TestDetail["questions"]): EditorQuestion[] {
  const byParent = new Map<string | null, TestDetail["questions"]>();
  for (const q of all) {
    const key = q.parentId ?? null;
    const list = byParent.get(key);
    if (list) list.push(q);
    else byParent.set(key, [q]);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
  function build(parentId: string | null): EditorQuestion[] {
    const direct = byParent.get(parentId) ?? [];
    return direct.map((q) => ({
      clientId: `id:${q.id}`,
      question: q.question,
      type: q.type as EditorQuestionType,
      points: q.points,
      options: q.options,
      answer: q.answer,
      language: q.language,
      // Prisma stores matchPairs as unknown JSON — coerce to the array
      // shape the editor expects, falling back to empty when null.
      matchPairs: Array.isArray(q.matchPairs)
        ? (q.matchPairs as Array<{ left: string; right: string }>)
        : [],
      reorderItems: q.reorderItems,
      blankCount: q.blankCount,
      subQuestions: build(q.id),
    }));
  }
  return build(null);
}

export default async function EditTestPage({ params }: PageProps) {
  const { id: testId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const owns = await testBelongsToTutor(testId, tutor.id);
  if (!owns) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t own this test.
      </div>
    );
  }

  // Fingerprint first: if a save lands between the two reads, the editor
  // holds the older fingerprint and the next save is refused rather than
  // silently overwriting.
  const baseFingerprint = await loadTestFingerprint(prisma, testId);
  const [test, courses] = await Promise.all([
    getTestDetailById(testId),
    listCoursesByTutorId(tutor.id),
  ]);
  if (!test) notFound();

  const editorQuestions = buildEditorTree(test.questions);

  return (
    <TestFrame test={test} page="Questions" actions={<ExportTestButton testId={test.id} />}>
      {/* "Preview as student" lives in the form's save bar: it saves
          first, so the preview always shows the latest edits. */}
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="sr-only">Edit {test.title}</h1>
        <TestForm
          courses={courses.map((c) => ({ id: c.id, name: c.name }))}
          defaultValues={{
            id: test.id,
            title: test.title,
            description: test.description,
            courseId: test.courseId,
            dueDate: test.dueDate,
            timeLimit: test.timeLimit,
            totalPoints: test.totalPoints,
            isActive: test.isActive,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            releaseAutoMarksToStudent: (test as any).releaseAutoMarksToStudent ?? false,
            preTestInstructions: test.preTestInstructions,
            memoFileUrls: test.memoFileUrls,
            labelScheme: test.labelScheme,
            questions: editorQuestions,
            baseFingerprint: baseFingerprint ?? undefined,
          }}
        />
      </div>
    </TestFrame>
  );
}
