/**
 * Calendar events from an .ics file (#216, phase 1): Google, Outlook or
 * Apple calendar exports, or a school's term calendar. One row per event,
 * each into a course (the screen's default course, changeable per row).
 * Repeating events keep their repeat rule; skipped dates come in as
 * cancelled occurrences. All-day events come in as holidays.
 *
 * An event already on that course's calendar (same title and start) is
 * skipped, so importing the same file twice adds nothing.
 */

import "server-only";

import type { EventType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { scopedCourseWhere } from "@/lib/viewer-core";
import { UserError } from "@/lib/user-error";

import { parseRRule, readIcs, repeatText } from "../ics";
import type { Importer, ImportContext, Issue, RowAction } from "../types";

export type CalendarRow = {
  course: string;
  title: string;
  type: string;
  /** ISO 8601 (UTC) start of the first occurrence. */
  start: string;
  duration_minutes: string;
  time_zone: string;
  all_day: string;
  repeat: string;
  /** ISO starts of skipped occurrences, comma-separated. */
  skipped_dates: string;
  location: string;
  link: string;
  description: string;
  /** RRULE parts that can't be kept, for a warning. */
  repeat_dropped: string;
};

const TYPES = ["LECTURE", "TEST", "REMINDER", "SUBMISSION", "LIVE", "EXAM", "MEETING", "HOLIDAY"] as const;
const MAX_MINUTES = 14 * 1440;

async function coursesFor(ctx: ImportContext) {
  const courses = await prisma.course.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(ctx.teachingMembershipId ? scopedCourseWhere({ membershipId: ctx.teachingMembershipId, branchIds: ctx.branchIds }) : {}),
    },
    select: { id: true, name: true },
  });
  const byName = new Map<string, string | "ambiguous">();
  for (const c of courses) {
    const k = c.name.trim().toLowerCase();
    byName.set(k, byName.has(k) ? "ambiguous" : c.id);
  }
  return byName;
}

function courseIdOf(byName: Map<string, string | "ambiguous">, name: string, issues: Issue[]): string | null {
  if (!name.trim()) {
    issues.push({ field: "course", level: "error", message: "Choose the course this event belongs to." });
    return null;
  }
  const id = byName.get(name.trim().toLowerCase());
  if (id === undefined) issues.push({ field: "course", level: "error", message: `No course called "${name}" that you can add events to.` });
  else if (id === "ambiguous") issues.push({ field: "course", level: "error", message: `Two courses are called "${name}". Rename one first.` });
  else return id;
  return null;
}

type Parsed = { courseId: string; type: EventType; start: Date; duration: number; repeat: ReturnType<typeof parseRRule>["repeat"]; skipped: Date[] };

function parseRow(byName: Map<string, string | "ambiguous">, r: CalendarRow, issues: Issue[]): Parsed | null {
  const courseId = courseIdOf(byName, r.course, issues);
  if (!r.title.trim()) issues.push({ field: "title", level: "error", message: "Give the event a title." });
  else if (r.title.length > 200) issues.push({ field: "title", level: "error", message: "Keep the title under 200 characters." });
  const type = r.type.trim().toUpperCase() as EventType;
  if (!(TYPES as readonly string[]).includes(type)) issues.push({ field: "type", level: "error", message: `Type can be ${TYPES.map((t) => t.toLowerCase()).join(", ")}.` });
  const start = new Date(r.start);
  if (Number.isNaN(start.getTime())) issues.push({ field: "start", level: "error", message: "That start time can't be read." });
  const duration = Number(r.duration_minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES) issues.push({ field: "duration_minutes", level: "error", message: "Length must be between 1 minute and 14 days." });
  const repeat = r.repeat.trim() ? parseRRule(r.repeat.trim(), r.time_zone || "Africa/Johannesburg") : { repeat: null, dropped: [] };
  if (r.repeat.trim() && !repeat.repeat) issues.push({ field: "repeat", level: "error", message: "That repeat rule can't be read." });
  const skipped = r.skipped_dates.split(",").map((s) => s.trim()).filter(Boolean).map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()));
  if (issues.some((i) => i.level === "error") || !courseId) return null;
  return { courseId, type, start, duration, repeat: repeat.repeat, skipped };
}

export const calendarImporter: Importer<CalendarRow> = {
  kind: "calendar",
  title: "Calendar events (.ics)",
  template: { headers: [], examples: [] },

  read() {
    return { rows: [], fileIssues: [{ level: "error", message: "Upload a calendar (.ics) file." }] };
  },

  readText(text, extra) {
    const ics = readIcs(text, extra.timeZone);
    const fileIssues: Issue[] = ics.problems.map((p) => ({ level: ics.events.length ? "warning" : "error", message: p }));
    if (ics.changedOccurrences) {
      fileIssues.push({ level: "warning", message: `${ics.changedOccurrences} changed single occurrence${ics.changedOccurrences === 1 ? "" : "s"} can't be imported; the series is imported as it repeats.` });
    }
    const rows = ics.events.map((e) => ({
      course: extra.defaults.course ?? "",
      title: e.title,
      type: e.allDay ? "HOLIDAY" : (extra.defaults.type ?? "LECTURE"),
      start: e.start.toISOString(),
      duration_minutes: String(e.durationMinutes),
      time_zone: e.timeZone,
      all_day: e.allDay ? "yes" : "no",
      repeat: repeatText(e.repeat),
      skipped_dates: e.excluded.map((d) => d.toISOString()).join(","),
      location: e.location.slice(0, 300),
      link: e.link.slice(0, 500),
      description: e.description.slice(0, 5000),
      repeat_dropped: e.repeatDropped.join(", "),
    }));
    return { rows, fileIssues };
  },

  async check(ctx, rows) {
    const byName = await coursesFor(ctx);
    const parsed = rows.map((r) => {
      const issues: Issue[] = [];
      return { issues, p: parseRow(byName, r, issues) };
    });
    // Already on the calendar: same course, title and first start.
    const keys = parsed.flatMap((x, i) => (x.p ? [{ courseId: x.p.courseId, title: rows[i].title.trim(), date: x.p.start }] : []));
    const existing = keys.length
      ? await prisma.courseEvent.findMany({ where: { OR: keys.map((k) => ({ courseId: k.courseId, title: k.title, date: k.date })) }, select: { courseId: true, title: true, date: true } })
      : [];
    const have = new Set(existing.map((e) => `${e.courseId}|${e.title}|${e.date.toISOString()}`));
    const seen = new Set<string>();
    return rows.map((r, i) => {
      const { issues, p } = parsed[i];
      let action: RowAction = "create";
      if (r.repeat_dropped) issues.push({ field: "repeat", level: "warning", message: `Only the basic repeat is kept (${r.repeat_dropped} dropped). Check the dates after importing.` });
      if (p) {
        const key = `${p.courseId}|${r.title.trim()}|${p.start.toISOString()}`;
        if (have.has(key)) { action = "skip"; issues.push({ level: "warning", message: "Already on this course's calendar." }); }
        else if (seen.has(key)) { action = "skip"; issues.push({ level: "warning", message: "The same event is in the file twice." }); }
        seen.add(key);
      }
      return { action, issues };
    });
  },

  async apply(ctx, row) {
    const issues: Issue[] = [];
    const p = parseRow(await coursesFor(ctx), row.data, issues);
    if (!p) throw new UserError(issues[0]?.message ?? "This event can't be imported.");
    const r = row.data;
    const event = await prisma.$transaction(async (tx) => {
      const e = await tx.courseEvent.create({
        data: {
          courseId: p.courseId, title: r.title.trim(), description: r.description, type: p.type, date: p.start, duration: p.duration,
          location: r.location || null, link: r.link || null, timeZone: r.time_zone || "Africa/Johannesburg",
          repeatFrequency: p.repeat?.frequency ?? "NONE", repeatInterval: p.repeat?.interval ?? 1, repeatWeekdays: p.repeat?.weekdays ?? [],
          repeatUntil: p.repeat?.until ?? null, repeatCount: p.repeat?.count ?? null,
        },
        select: { id: true },
      });
      if (p.repeat && p.skipped.length) {
        await tx.courseEventException.createMany({
          data: p.skipped.map((d) => ({ eventId: e.id, occurrenceStart: d, cancelled: true, createdByUserId: ctx.actor.userId })),
          skipDuplicates: true,
        });
      }
      return e;
    }, { timeout: 30_000 });
    return { outcome: "done", result: p.repeat ? `Added, repeating ${p.repeat.frequency.toLowerCase()}` : "Added", undo: { eventId: event.id } };
  },

  async undo(_ctx, raw) {
    const { eventId } = raw as { eventId: string };
    const marked = await prisma.sessionAttendance.count({ where: { eventId } });
    if (marked) return { undone: false, note: "attendance was taken for it" };
    await prisma.courseEvent.deleteMany({ where: { id: eventId } });
    return { undone: true };
  },
};
