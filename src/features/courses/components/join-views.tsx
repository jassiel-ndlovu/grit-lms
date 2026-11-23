/**
 * Join requests, display only (#206). The pages load A's data
 * (listListedCourses, listMyJoinRequests, listJoinRequestsForStaff) and
 * pass it here; /design-system/join passes samples. Buttons are the client
 * pieces in ./join-requests.tsx.
 */

import { SaverCover } from "@/components/data-saver";
import { Building2, Users } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { formatDate, type DateContext } from "@/lib/datetime";

import { askedBy, enrolledLabel, JOIN_STATUS_CHIP, noteFrom, openRequestFor, type AskFor, type JoinStatus } from "../lib/join-ui";
import { courseCoverSrc } from "../lib/stock-covers";
import {
  ApproveRequestButton, CancelRequestButton, DeclineRequestButton, RequestJoinButton,
} from "./join-requests";

/** listListedCourses' ListedCourse. */
export interface ListedCourseRow {
  courseId: string;
  name: string;
  description: string | null;
  imageUrl: string;
  workspace: { id: string; name: string; kind: "ORGANISATION" | "SOLO"; logoUrl: string | null };
  tutors: string[];
  /** The viewer and their children already on it. */
  enrolledUserIds?: string[];
}

/** A listMyJoinRequests row. */
export interface MyRequestRow {
  id: string;
  status: JoinStatus;
  message: string | null;
  declineReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  course: { id: string; name: string; imageUrl: string };
  workspaceName: string;
  student: { id: string; name: string };
  madeByMe: boolean;
}

/** A listJoinRequestsForStaff row. */
export interface StaffRequestRow {
  id: string;
  status: JoinStatus;
  message: string | null;
  declineReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  course: { id: string; name: string };
  studentName: string;
  parentName: string | null;
  decidedBy?: { id: string; name: string } | null;
}

const day = (iso: string, ctx: DateContext) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });

/* ───── Browse ───── */

export function ListedCourseGrid({
  courses,
  targets,
  mine,
}: {
  courses: ListedCourseRow[];
  /** Who the viewer may ask for; empty shows no buttons (tutors browsing). */
  targets: AskFor[];
  mine: MyRequestRow[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const enrolled = c.enrolledUserIds ?? [];
        const onIt = enrolledLabel(targets, enrolled);
        const notOnIt = targets.filter((t) => !enrolled.includes(t.userId));
        const free = notOnIt.filter((t) => !openRequestFor(mine, c.courseId, t.userId));
        const waiting = notOnIt.length > 0 && free.length === 0;
        return (
          <li key={c.courseId} className="border-border flex flex-col overflow-hidden rounded-lg border">
            <div className="bg-muted relative aspect-video w-full">
              <SaverCover src={courseCoverSrc(c)} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="text-foreground line-clamp-2 text-base leading-snug font-semibold">{c.name}</h3>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Building2 aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{c.workspace.name}</span>
              </p>
              {c.tutors.length > 0 ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Users aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">with {c.tutors.join(", ")}</span>
                </p>
              ) : null}
              {c.description ? <p className="text-muted-foreground line-clamp-3 text-sm">{c.description}</p> : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <span className="flex flex-wrap gap-1.5">
                  {onIt ? <StatusChip tone="success">{onIt}</StatusChip> : null}
                  {waiting ? <StatusChip tone="info">Request sent</StatusChip> : null}
                </span>
                <RequestJoinButton courseId={c.courseId} courseName={c.name} workspaceName={c.workspace.name} targets={free} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MyRequestsList({ rows, ctx, meId }: { rows: MyRequestRow[]; ctx: DateContext; /** The viewer's user id. */ meId: string }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {rows.map((r) => {
        const chip = JOIN_STATUS_CHIP[r.status];
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <p className="text-foreground font-medium">{r.course.name}</p>
              <p className="text-muted-foreground text-xs">
                {r.workspaceName}
                {r.madeByMe && r.student.id !== meId ? ` · for ${r.student.name}` : ""}
                {!r.madeByMe ? " · a parent asked for you" : ""} · asked {day(r.createdAt, ctx)}
              </p>
              {r.status === "DECLINED" && r.declineReason ? (
                <p className="text-muted-foreground text-xs">&ldquo;{r.declineReason}&rdquo;</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
              {r.status === "PENDING" && r.madeByMe ? <CancelRequestButton requestId={r.id} label="Cancel" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───── Staff inbox ───── */

export function StaffRequestList({ rows, ctx, meId }: { rows: StaffRequestRow[]; ctx: DateContext; /** The viewer's user id. */ meId?: string }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {rows.map((r) => {
        const chip = JOIN_STATUS_CHIP[r.status];
        return (
          <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="text-foreground font-medium">
                {r.studentName} <span className="text-muted-foreground font-normal">→ {r.course.name}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {askedBy(r.studentName, r.parentName)} on {day(r.createdAt, ctx)}
                {r.decidedAt ? ` · decided ${day(r.decidedAt, ctx)}` : ""}
              </p>
              {r.message ? <p className="bg-muted/60 rounded-md px-3 py-2 text-sm">&ldquo;{r.message}&rdquo;</p> : null}
              {r.status === "DECLINED" && r.declineReason ? (
                <p className="text-muted-foreground text-xs">{noteFrom(r.decidedBy, meId)}: &ldquo;{r.declineReason}&rdquo;</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.status === "PENDING" ? (
                <>
                  <DeclineRequestButton requestId={r.id} studentName={r.studentName} />
                  <ApproveRequestButton requestId={r.id} studentName={r.studentName} courseName={r.course.name} byParent={r.parentName != null} />
                </>
              ) : (
                <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function NoListedCourses({ searched, workspace = false }: { searched: boolean; /** Filtered to one workspace. */ workspace?: boolean }) {
  if (workspace && !searched) {
    return (
      <EmptyState
        illustration={<Scene name="empty-courses" />}
        title="No courses open here right now"
        description="This tutor or school isn't taking new students through Find courses at the moment. You can look at the other courses."
      />
    );
  }
  return (
    <EmptyState
      illustration={<Scene name={searched ? "search-no-results" : "empty-courses"} />}
      title={searched ? "No courses match that search" : "No courses are listed yet"}
      description={searched ? "Try a shorter word, or the name of the school or tutor." : "When tutors list their courses, they show up here."}
    />
  );
}

export function NoJoinRequests({ status }: { status: JoinStatus }) {
  return (
    <EmptyState
      illustration={<Scene name="inbox-empty" />}
      title={status === "PENDING" ? "No requests waiting" : `No ${JOIN_STATUS_CHIP[status].label.toLowerCase()} requests`}
      description={
        status === "PENDING"
          ? "When students or parents ask to join one of your listed courses, the request lands here. List a course in its settings."
          : "Requests you decide show up here."
      }
    />
  );
}
