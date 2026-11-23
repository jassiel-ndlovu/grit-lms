/**
 * /dashboard/tutor-tests/[id]/analysis — item analysis for one test (Plus
 * service "advanced-analytics"). How hard each question was, whether it
 * tells stronger students from weaker ones, which wrong answers were common
 * and which topics need work. Numbers come from fully marked attempts only
 * (features/assessments/lib/item-analysis.ts).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowDownWideNarrow, ListOrdered } from "lucide-react";

import LessonMarkdown from "@/app/components/markdown";
import { MathsAnswerText } from "@/components/content/answer-text";
import { PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { TestFrame, hasItemAnalysis, testRoutes } from "@/features/assessments/components/test-frame";
import { plainPreview } from "@/features/assessments/lib/ai-marking-ui";
import {
  MIN_FOR_DISCRIMINATION, analyseTest, hardestFirst, latestPerStudent, type Difficulty, type Discrimination, type ItemRow,
} from "@/features/assessments/lib/item-analysis";
import { getTestDetailById, listSubmissionsForTest, testBelongsToTutor } from "@/features/assessments/queries";
import { getCourseScope } from "@/features/courses/course-access";
import { topicByCode } from "@/features/courses/lib/curriculum";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export const metadata = { title: "Test analysis" };

const DIFFICULTY: Record<Difficulty, { label: string; tone: StatusTone }> = {
  hard: { label: "Hard", tone: "warning" },
  medium: { label: "Medium", tone: "info" },
  easy: { label: "Easy", tone: "success" },
};

const DISCRIMINATION: Record<Discrimination, string> = {
  good: "Separates students well",
  weak: "Separates students a little",
  poor: "Barely separates students",
  negative: "Works against stronger students",
};

const percent = (share: number) => `${Math.round(share * 100)}%`;
const marks = (n: number) => String(Math.round(n * 10) / 10);

/** A bar of `share` (0 to 1). The number is always printed beside it. */
function Bar({ share }: { share: number }) {
  return (
    <span aria-hidden className="bg-muted block h-1.5 w-full overflow-hidden rounded-full">
      <span className="bg-primary block h-full rounded-full" style={{ width: percent(share) }} />
    </span>
  );
}

function Item({ item }: { item: ItemRow }) {
  const answered = item.attempts - item.blank;
  return (
    <li>
      <details className="group">
        <summary className="hover:bg-muted/40 flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3">
          <span className="text-muted-foreground w-10 shrink-0 text-sm tabular-nums">{item.label}</span>
          <span className="text-foreground min-w-0 flex-1 basis-48 truncate text-sm">
            {plainPreview(item.question) || "Question"}
          </span>
          {item.warnings.length ? (
            <span className="text-warning inline-flex items-center gap-1 text-xs font-medium">
              <AlertTriangle aria-hidden className="size-3.5" />
              Check
            </span>
          ) : null}
          {item.difficulty !== null && item.difficultyLabel ? (
            <>
              <span className="flex w-32 shrink-0 items-center gap-2">
                <Bar share={item.difficulty} />
                <span className="text-foreground w-10 shrink-0 text-right text-sm tabular-nums">{percent(item.difficulty)}</span>
              </span>
              <StatusChip tone={DIFFICULTY[item.difficultyLabel].tone}>{DIFFICULTY[item.difficultyLabel].label}</StatusChip>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">No marks yet</span>
          )}
        </summary>

        <div className="space-y-4 px-2 pt-1 pb-5 sm:pl-16">
          <LessonMarkdown content={item.question} className="prose-sm" />

          {item.warnings.map((w) => (
            <p key={w.kind} className="text-foreground flex items-start gap-2 text-sm">
              <AlertTriangle aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
              {w.text}
            </p>
          ))}

          {item.difficulty !== null && item.averageMark !== null ? (
            <dl className="grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-xs">Average mark</dt>
                <dd className="text-foreground tabular-nums">
                  {marks(item.averageMark)} of {item.points}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Full marks</dt>
                <dd className="text-foreground tabular-nums">
                  {item.full} of {item.attempts}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Some marks</dt>
                <dd className="text-foreground tabular-nums">{item.part}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">No marks</dt>
                <dd className="text-foreground tabular-nums">
                  {item.none}
                  {item.blank ? <span className="text-muted-foreground"> ({item.blank} blank)</span> : null}
                </dd>
              </div>
            </dl>
          ) : null}

          {item.discriminationLabel && item.discrimination !== null ? (
            <p className="text-muted-foreground text-sm">
              {DISCRIMINATION[item.discriminationLabel]}{" "}
              <span className="tabular-nums">({item.discrimination.toFixed(2)})</span>
            </p>
          ) : null}

          {item.choices.length && item.attempts ? (
            <ul className="max-w-2xl space-y-2" aria-label="Answers chosen">
              {item.choices.map((c) => (
                <li key={c.text} className="text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className={item.type === "TRUE_FALSE" ? "capitalize" : undefined}>
                        <LessonMarkdown content={c.text} className="prose-sm" />
                      </span>
                      {c.correct ? <span className="text-success shrink-0 text-xs font-medium">Marked answer</span> : null}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {c.count} of {answered}
                    </span>
                  </span>
                  <Bar share={answered ? c.count / answered : 0} />
                </li>
              ))}
            </ul>
          ) : null}

          {item.wrongAnswers.length ? (
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Common wrong answers</p>
              <ul className="mt-1 space-y-0.5">
                {item.wrongAnswers.map((w) => (
                  <li key={w.text}>
                    {item.type === "MATH_EXPRESSION" ? <MathsAnswerText tex={w.text} /> : w.text}{" "}
                    <span className="text-muted-foreground tabular-nums">× {w.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

export default async function TestAnalysisPage({ params, searchParams }: PageProps) {
  const [{ id: testId }, { sort }] = await Promise.all([params, searchParams]);

  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const scope = await getCourseScope(session.user.id);
  if (!(await testBelongsToTutor(testId, scope))) {
    return (
      <PageMessage breadcrumb={[{ label: "Tests", href: testRoutes.list }, { label: "Test" }]}>
        You don&apos;t own this test.
      </PageMessage>
    );
  }
  const test = await getTestDetailById(testId);
  if (!test) notFound();
  // The tab is hidden without the service, so the page doesn't exist either.
  if (!(await hasItemAnalysis(test.courseId))) notFound();

  const submissions = latestPerStudent((await listSubmissionsForTest(testId)).filter((s) => s.status !== "IN_PROGRESS"));
  const marked = submissions.filter((s) => s.status === "GRADED");
  const toMark = submissions.length - marked.length;
  const result = analyseTest(test.questions, marked, test.labelScheme);
  const byDifficulty = sort === "hardest";
  const items = byDifficulty ? hardestFirst(result.items) : result.items;
  const toCheck = result.items.filter((i) => i.warnings.length).length;

  return (
    <TestFrame test={test} page="Analysis">
      <PageTitle
        title="Analysis"
        description={
          result.attempts
            ? [
                `${result.attempts} marked ${result.attempts === 1 ? "attempt" : "attempts"}`,
                result.average !== null ? `average ${percent(result.average)}` : null,
                toMark ? `${toMark} still to mark` : null,
                toCheck ? `${toCheck} ${toCheck === 1 ? "question" : "questions"} to check` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "How each question performed, once attempts are marked."
        }
      />

      {result.attempts === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="nothing-to-grade" />}
          title="No marked attempts yet"
          description={
            toMark
              ? `${toMark} ${toMark === 1 ? "attempt is" : "attempts are"} waiting to be marked. The analysis uses marked attempts only.`
              : "The analysis shows up after students sit the test and you mark it."
          }
        />
      ) : (
        <>
          {result.attempts < MIN_FOR_DISCRIMINATION ? (
            <p className="text-muted-foreground text-sm">
              With fewer than {MIN_FOR_DISCRIMINATION} marked attempts, treat these numbers as a rough guide. How well a
              question separates students shows from {MIN_FOR_DISCRIMINATION}.
            </p>
          ) : null}

          {result.topics.length ? (
            <PageSection title="Topics, weakest first">
              <ul className="divide-border border-border divide-y border-y">
                {result.topics.map((t) => (
                  <li key={t.topic} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-2.5 text-sm">
                    <span className="text-foreground min-w-0 flex-1 basis-48">{topicByCode(t.topic)?.title ?? t.topic}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {t.questions} {t.questions === 1 ? "question" : "questions"}
                    </span>
                    <span className="flex w-32 shrink-0 items-center gap-2">
                      <Bar share={t.average} />
                      <span className="text-foreground w-10 shrink-0 text-right tabular-nums">{percent(t.average)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </PageSection>
          ) : null}

          <PageSection
            title="Questions"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href={byDifficulty ? testRoutes.analysis(test.id) : `${testRoutes.analysis(test.id)}?sort=hardest`} scroll={false}>
                  {byDifficulty ? (
                    <ListOrdered aria-hidden className="size-4" />
                  ) : (
                    <ArrowDownWideNarrow aria-hidden className="size-4" />
                  )}
                  {byDifficulty ? "Test order" : "Hardest first"}
                </Link>
              </Button>
            }
          >
            <p className="text-muted-foreground text-xs">
              The percentage is the average mark. Open a question to see how students answered.
            </p>
            <ul className="divide-border border-border divide-y border-y">
              {items.map((item) => (
                <Item key={item.id} item={item} />
              ))}
            </ul>
          </PageSection>
        </>
      )}
    </TestFrame>
  );
}
