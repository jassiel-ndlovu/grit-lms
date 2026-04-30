/**
 * SubmissionCard — single assignment row used in student/tutor submission lists.
 * RSC-safe. Status pill is derived from the (optional) `entry` prop.
 */

import Link from "next/link";
import { CalendarDays, FileUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type CardSubmission = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  totalPoints: number;
  course: { id: string; name: string };
  _count?: { entries?: number };
};

type CardEntry = {
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "GRADED"
    | "LATE"
    | "NOT_SUBMITTED";
  attemptNumber: number;
  grade: { score: number; outOf: number } | null;
} | null;

export interface SubmissionCardProps {
  submission: CardSubmission;
  entry?: CardEntry;
  href: string;
  actions?: React.ReactNode;
  className?: string;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function statusFor(entry: CardEntry, dueDate: Date) {
  if (!entry) {
    return dueDate.getTime() < Date.now()
      ? { label: "Past due", tone: "destructive" as const }
      : { label: "Not submitted", tone: "muted" as const };
  }
  switch (entry.status) {
    case "GRADED":
      return { label: "Graded", tone: "brand" as const };
    case "SUBMITTED":
      return { label: "Awaiting grade", tone: "soft" as const };
    case "LATE":
      return { label: "Late", tone: "destructive" as const };
    case "IN_PROGRESS":
      return { label: "In progress", tone: "secondary" as const };
    default:
      return { label: "Not submitted", tone: "muted" as const };
  }
}

export function SubmissionCard({
  submission,
  entry,
  href,
  actions,
  className,
}: SubmissionCardProps) {
  const status = statusFor(entry ?? null, submission.dueDate);
  const score = entry?.grade?.score ?? null;
  const outOf = entry?.grade?.outOf ?? submission.totalPoints;

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
              {submission.course.name}
            </p>
            <h3 className="font-display line-clamp-2 text-lg leading-tight tracking-tight text-foreground">
              {submission.title}
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

        {submission.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {submission.description}
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            Due {dateFmt.format(submission.dueDate)}
          </span>
          {entry && entry.attemptNumber > 1 && (
            <span className="inline-flex items-center gap-1">
              <FileUp className="size-3" />
              Attempt {entry.attemptNumber}
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
