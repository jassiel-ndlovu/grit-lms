"use client";

/**
 * Class mode (owner, 24 Nov): the one page a session needs. What it is and
 * how long is left, Join, check-in, the register for staff, the lessons and
 * what's due next. The page (dashboard/calendar/class/[eventId]) decides who
 * sees what; this only draws it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Circle, CircleCheck, MapPin, RefreshCw, Video } from "lucide-react";

import { useDateContext } from "@/components/preferences-provider";
import { PageSection } from "@/components/shell/page-frame";
import { StatusChip, type StatusTone } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { NexusLoader, TonePanel } from "@/components/ui/nexus";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate } from "@/lib/datetime";
import { dueTone } from "@/lib/nexus";
import { cn } from "@/lib/utils";

import { joinOpen, meetingProvider, meetingProviderOf } from "../lib/calendar-ui";
import { classPercent, classPhase, phaseLabel, PHASE_TONE, type ClassPhase } from "../lib/class-mode";
import { AttendanceSheet, CheckInPanel, type SheetLearner } from "./attendance-sheet";
import { CheckInButton } from "./calendar-tools";
import { MeetingAppMark } from "./meeting-app-mark";

export interface ClassModeProps {
  session: {
    eventId: string; occurrenceStart: string; start: string; end: string | null; cancelled: boolean;
    link: string | null; location: string | null; description: string | null;
  };
  /** The server's clock, so the first paint matches. */
  now: number;
  /** Staff who may take the register. */
  staff: { learners: SheetLearner[]; checkInOpenUntil: string | null; checkInCodes: boolean } | null;
  /** A learner, and whether they may type a check-in code. */
  learner: { checkIn: boolean } | null;
  lessons: Array<{ id: string; title: string; href: string; done: boolean | null }>;
  lessonsHref: string;
  due: Array<{ id: string; kind: "Test" | "Assignment"; title: string; at: string; href: string }>;
}

const TICK_MS = 15_000;

function useNow(initial: number): number {
  const [now, setNow] = React.useState(initial);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

const CHIP: Record<ClassPhase, { label: string; tone: StatusTone }> = {
  cancelled: { label: "Cancelled", tone: "danger" },
  before: { label: "Later", tone: "neutral" },
  soon: { label: "Soon", tone: "warning" },
  on: { label: "On now", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
};

export function ClassMode({ session: s, now: serverNow, staff, learner, lessons, lessonsHref, due }: ClassModeProps) {
  const now = useNow(serverNow);
  const ctx = useDateContext();
  const phase = classPhase(s, now);
  const percent = classPercent(s, now);
  const canJoin = Boolean(s.link) && joinOpen(s, new Date(now));
  const provider = meetingProvider(s.link);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-8">
        <TonePanel as="section" tone={PHASE_TONE[phase]} nexus={`class-${s.eventId}`} aria-labelledby="class-now" className="space-y-4 p-5">
          <div className="space-y-2 pr-20">
            <StatusChip tone={CHIP[phase].tone}>{CHIP[phase].label}</StatusChip>
            <h2 id="class-now" className="text-foreground text-xl font-semibold tabular-nums">
              {phaseLabel(s, now)}
            </h2>
          </div>
          {percent !== null ? <ProgressBar label="Session time" value={percent} valueText={phaseLabel(s, now)} tone="success" /> : null}
          {s.location ? (
            <p className="text-foreground flex items-center gap-1.5 text-sm">
              <MapPin aria-label="Place" className="text-muted-foreground size-4" /> {s.location}
            </p>
          ) : null}
          {s.description ? <p className="text-foreground max-w-prose text-sm whitespace-pre-line">{s.description}</p> : null}
          {s.cancelled ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {s.link ? (
                <Button asChild size={canJoin ? "lg" : "default"} variant={canJoin ? "default" : "outline"}>
                  <a href={s.link} target="_blank" rel="noreferrer">
                    {canJoin ? <Video aria-hidden className="size-4" /> : <MeetingAppMark provider={meetingProviderOf(s.link)} className="size-4" />}
                    {canJoin ? `Join${provider ? ` on ${provider}` : ""}` : `Open ${provider ?? "meeting"} link`}
                  </a>
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">No meeting link on this session.</p>
              )}
              {learner?.checkIn && (phase === "on" || phase === "soon") ? <CheckInButton size={canJoin ? "default" : "sm"} /> : null}
            </div>
          )}
        </TonePanel>

        {staff && !s.cancelled ? (
          <>
            {staff.checkInCodes && phase !== "ended" ? (
              <PageSection id="check-in" title="Check-in code">
                <CheckInPanel eventId={s.eventId} occurrenceStart={s.occurrenceStart} openUntil={staff.checkInOpenUntil} />
              </PageSection>
            ) : null}
            <PageSection id="register" title="Register" description="P present, L late, A absent, E excused." actions={<RefreshButton />}>
              {/* A new key when the server's marks change, so "Update" shows who checked in. */}
              <AttendanceSheet
                key={staff.learners.map((l) => `${l.learnerId}:${l.status ?? ""}`).join("|")}
                eventId={s.eventId}
                occurrenceStart={s.occurrenceStart}
                learners={staff.learners}
              />
            </PageSection>
          </>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4">
        <TonePanel as="section" aria-labelledby="class-lessons" className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="class-lessons" className="text-foreground text-base font-semibold">
              Lessons
            </h2>
            <Link href={lessonsHref} className="text-muted-foreground hover:text-foreground text-xs hover:underline">
              All lessons
            </Link>
          </div>
          {lessons.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lessons on this course yet.</p>
          ) : (
            <ul className={cn("divide-border divide-y text-sm", lessons.length > 6 && "max-h-72 overflow-y-auto")}>
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="hover:bg-muted/50 flex items-center gap-2 rounded px-1 py-2">
                    {l.done === null ? (
                      <BookOpen aria-hidden className="text-muted-foreground size-4 shrink-0" />
                    ) : l.done ? (
                      <CircleCheck aria-label="Done" className="text-success size-4 shrink-0" />
                    ) : (
                      <Circle aria-label="To do" className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="text-foreground min-w-0 truncate">{l.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TonePanel>

        <TonePanel as="section" aria-labelledby="class-due" className="space-y-2">
          <h2 id="class-due" className="text-foreground text-base font-semibold">
            Due next
          </h2>
          {due.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing due in the next two weeks.</p>
          ) : (
            <ul className="-mx-4 text-sm">
              {due.map((d) => (
                <li key={`${d.kind}-${d.id}`} data-slot="tone-row" data-tone={dueTone(new Date(d.at), new Date(now))}>
                  <Link href={d.href} className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="text-foreground block truncate">{d.title}</span>
                      <span className="text-muted-foreground block text-xs">{d.kind}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatDate(new Date(d.at), ctx, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TonePanel>
      </aside>
    </div>
  );
}

/** Check-ins come from the learners' own pages: fetch the register again. */
function RefreshButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? <NexusLoader size={16} label={null} className="text-current" /> : <RefreshCw aria-hidden className="size-4" />}
      Update
    </Button>
  );
}
