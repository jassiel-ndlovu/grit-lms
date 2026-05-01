/**
 * TestCard — single test row used in student/tutor test lists.
 *
 * Server Component by default. Status pill (not-started / in-progress /
 * submitted / graded) is derived from the optional `submission` prop so
 * the card can render uniformly for both student and tutor views.
 */

import Link from "next/link";
import { Clock, FileQuestion } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type TestCardTest = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  timeLimit: number | null;
  totalPoints: number;
  course: { id: string; name: string };
  _count?: { questions?: number; submissions?: number };
};

type TestCardSubmission = {
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "GRADED"
    | "LATE"
    | "NOT_SUBMITTED";
  score: number | null;
  grade: { score: number; outOf: number } | null;
} | null;

export interface TestCardProps {
  test: TestCardTest;
  submission?: TestCardSubmission;
  href: string;
  actions?: React.ReactNode;
  className?: string;
}

function statusFor(submission: TestCardSubmission, dueDate: Date) {
  if (!submission) {
    return dueDate.getTime() < Date.now()
      ? { label: "Past due", tone: "muted" as const }
      : { label: "Not started", tone: "muted" as const };
  }
  switch (submission.status) {
    case "GRADED":
      return { label: "Graded", tone: "brand" as const };
    case "SUBMITTED":
      return { label: "Awaiting grade", tone: "soft" as const };
    case "IN_PROGRESS":
      return { label: "In progress", tone: "secondary" as const };
    case "LATE":
      return { label: "Late", tone: "destructive" as const };
    default:
      return { label: "Not started", tone: "muted" as const };
  }
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function TestCard({
  test,
  submission,
  href,
  actions,
  className,
}: TestCardProps) {
  const status = statusFor(submission ?? null, test.dueDate);
  const score = submission?.grade?.score ?? null;
  const outOf = submission?.grade?.outOf ?? test.totalPoints;

  return (
    <Card
      className={cn(
        "group relative flex flex-col gap-3 p-5 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <Link href={href} className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs">
              {test.course.name}
            </p>
            <h3 className="font-display line-clamp-2 text-lg leading-tight tracking-tight text-foreground">
              {test.title}
            </h3>
          </div>
          <Badge
            variant={
              status.tone === "brand"
                ? "brand"
                : status.tone === "soft"
                  ? "soft"
                  : status.tone === "destructive"
                    ? "destructive"
                    : "secondary"
            }
            className="shrink-0"
          >
            {status.label}
          </Badge>
        </div>

        {test.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {test.description}
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            Due {dateFmt.format(test.dueDate)}
          </span>
          {test.timeLimit != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {test.timeLimit} min
            </span>
          )}
          {test._count?.questions != null && (
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-3" />
              {test._count.questions} questions
            </span>
          )}
        </div>

        {score != null && outOf > 0 && (
          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-xs">Score</span>
            <span className="font-display tabular-nums text-foreground">
              {score}
              <span className="text-muted-foreground"> / {outOf}</span>
            </span>
          </div>
        )}
      </Link>

      {actions && <div className="absolute top-3 right-3 z-10">{actions}</div>}
    </Card>
  );
}
