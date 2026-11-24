/**
 * Class mode (owner, 24 Nov): one page for a session while it runs. Pure, so
 * scripts/check-class-mode.ts covers it.
 */

import type { Tone } from "@/lib/nexus";

type Session = { start: string; end: string | null; cancelled: boolean };

export type ClassPhase = "cancelled" | "before" | "soon" | "on" | "ended";

/** Sessions without an end are taken to last an hour, as the Join button does. */
const DEFAULT_MS = 60 * 60 * 1000;
/** When Join opens, and the page starts to count down. */
export const SOON_MS = 15 * 60 * 1000;

export function classEnd(s: Session): number {
  return s.end ? Date.parse(s.end) : Date.parse(s.start) + DEFAULT_MS;
}

export function classPhase(s: Session, now: number): ClassPhase {
  if (s.cancelled) return "cancelled";
  const start = Date.parse(s.start);
  if (now > classEnd(s)) return "ended";
  if (now >= start) return "on";
  return start - now <= SOON_MS ? "soon" : "before";
}

/** "2 d 3 h", "1 h 5 min", "12 min", "less than a minute". */
export function spanLabel(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "less than a minute";
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

export function phaseLabel(s: Session, now: number): string {
  switch (classPhase(s, now)) {
    case "cancelled": return "Cancelled";
    case "ended": return "This session has ended";
    case "on": return `On now, ${spanLabel(classEnd(s) - now)} left`;
    default: return `Starts in ${spanLabel(Date.parse(s.start) - now)}`;
  }
}

export const PHASE_TONE: Record<ClassPhase, Tone> = {
  cancelled: "danger", before: "neutral", soon: "warning", on: "success", ended: "neutral",
};

/** How much of the session has passed, 0 to 100; null unless it is on. */
export function classPercent(s: Session, now: number): number | null {
  if (classPhase(s, now) !== "on") return null;
  const start = Date.parse(s.start);
  return Math.min(100, Math.max(0, ((now - start) / (classEnd(s) - start)) * 100));
}

/** For a learner: the next lessons to do, else the last few. */
export function lessonsToShow<L extends { id: string }>(lessons: readonly L[], done: ReadonlySet<string>, max = 4): L[] {
  const at = lessons.findIndex((l) => !done.has(l.id));
  return at < 0 ? lessons.slice(-max) : lessons.slice(at, at + max);
}
