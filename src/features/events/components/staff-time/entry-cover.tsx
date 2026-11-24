"use client";

/**
 * Cover on an opened class in the calendar: "I need cover" for its tutor,
 * "Arrange cover" for managers, and who covers once it's arranged.
 */

import * as React from "react";
import { UserRoundSearch } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";

import type { CalendarEntry } from "../../lib/calendar-ui";
import { coverable, coverChip, coverEntryId, coverLine } from "../../lib/staff-time-ui";
import type { CalendarCover } from "../../staff-time";
import { AssignCoverDialog, CoverButtons, RequestCoverDialog } from "./cover-actions";

export function EntryCover({ entry: e, cover: c, when }: {
  entry: CalendarEntry;
  cover: CalendarCover;
  /** "Tuesday 1 December at 14:00". */
  when: string;
}) {
  const [asking, setAsking] = React.useState<null | "self" | "other">(null);
  const [assigning, setAssigning] = React.useState<string | null>(null);

  if (e.kind !== "event" || !e.eventId || !e.occurrenceStart) return null;
  const now = new Date();
  const what = `${e.courseName}, ${when}`;
  const open = coverable(e, now);
  const live = c.byEntry[coverEntryId(e.eventId, e.occurrenceStart)] ?? null;
  const mine = open && c.myCourseIds.includes(e.courseId);
  const others = open && c.manages ? (c.staffByCourse[e.courseId] ?? []) : [];
  // A manager who teaches it alone only needs the one button.
  const canArrange = others.some((p) => p.membershipId !== c.me);
  if (!live && !mine && !canArrange) return null;

  const chip = live ? coverChip({ status: live.status, endsAt: new Date(e.end ?? e.start) }, now) : null;
  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
      {live && chip ? (
        <p className="text-foreground flex w-full flex-wrap items-center gap-2 text-sm">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          {coverLine(live, c.me)}
        </p>
      ) : null}
      {live && open && live.status !== "CANCELLED" ? (
        <CoverButtons cover={{ id: live.id, status: live.status, cover: live.cover }} what={what} manages={live.manageable} mine={live.absent.membershipId === c.me} />
      ) : null}
      {!live && mine ? (
        <WriteGuard label="I need cover">
          <Button type="button" size="sm" variant="outline" onClick={() => setAsking("self")}>
            <UserRoundSearch aria-hidden className="size-4" />
            I need cover
          </Button>
        </WriteGuard>
      ) : null}
      {!live && canArrange ? (
        <WriteGuard label="Arrange cover">
          <Button type="button" size="sm" variant="outline" onClick={() => setAsking("other")}>
            <UserRoundSearch aria-hidden className="size-4" />
            Arrange cover
          </Button>
        </WriteGuard>
      ) : null}
      <RequestCoverDialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        eventId={e.eventId}
        occurrenceStart={e.occurrenceStart}
        what={what}
        forOthers={asking === "other" ? others : null}
        onAsked={(id) => {
          const pick = asking === "other" || c.manages;
          setAsking(null);
          if (pick) setAssigning(id);
        }}
      />
      <AssignCoverDialog coverId={assigning} onClose={() => setAssigning(null)} what={what} current={null} />
    </div>
  );
}
