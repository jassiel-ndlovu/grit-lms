/**
 * Tutor timesheets and payroll export (#216 phase 3, organisations).
 * Contract: viewer.md, "Timesheets and cover".
 *
 * Tutors keep their own month; managers with `timesheets.manage` (their
 * branches, or the whole organisation) approve, set pay rates and export
 * payroll. Suggestions come from the calendar, cover and bookings
 * (./timesheet-math.ts); nothing is added until the tutor adds it.
 */

import "server-only";

import { occurrencesFor } from "@/features/calendar/calendar";
import { toCsv } from "@/features/imports/csv";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";

import { assertManages, managedMemberships } from "./scope";
import { canMove, monthRange, occurrenceKey, payCents, suggestEntries, TIMESHEET_LIMITS, type SuggestedEntry } from "./timesheet-math";

const PERM = "timesheets.manage" as const;

function staffOnly(viewer: Viewer) {
  if (!viewer.workspace || (viewer.persona !== "staff" && viewer.persona !== "admin")) throw new ViewerError("FORBIDDEN");
  return viewer.workspace;
}

async function zoneOf(workspaceId: string) {
  return (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } })).timezone;
}

function checkMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new UserError("Choose a month.");
}

async function sheetFor(workspaceId: string, membershipId: string, month: string) {
  return prisma.timesheet.upsert({
    where: { membershipId_month: { membershipId, month } },
    create: { workspaceId, membershipId, month },
    update: {},
    select: { id: true, status: true, submittedAt: true, decidedAt: true, decidedById: true, decisionNote: true, hourlyCents: true, totalMinutes: true, amountCents: true },
  });
}

/** What the calendar, cover and bookings suggest for a tutor's month. */
export async function suggestionsFor(workspaceId: string, membershipId: string, month: string): Promise<SuggestedEntry[]> {
  const { from, to } = monthRange(month, await zoneOf(workspaceId));
  const [taught, coverAway, coverIn, bookings] = await Promise.all([
    prisma.courseStaff.findMany({ where: { membershipId }, select: { courseId: true } }),
    prisma.coverRequest.findMany({ where: { absentMembershipId: membershipId, status: "ASSIGNED", startsAt: { gte: from, lt: to } }, select: { eventId: true, occurrenceStart: true } }),
    prisma.coverRequest.findMany({ where: { coverMembershipId: membershipId, status: "ASSIGNED", startsAt: { gte: from, lt: to } }, select: { courseId: true, eventId: true, occurrenceStart: true } }),
    prisma.booking.findMany({ where: { membershipId, startsAt: { gte: from, lt: to } }, select: { id: true, courseId: true, startsAt: true, endsAt: true, status: true } }),
  ]);
  // Courses they reach only because they're covering a class there: not their own classes.
  const coverOnly = new Set((await prisma.coverRequest.findMany({ where: { coverMembershipId: membershipId, addedCourseStaff: true, accessEndedAt: null, status: "ASSIGNED" }, select: { courseId: true } })).map((c) => c.courseId));
  const own = (await occurrencesFor({ courseIds: taught.map((t) => t.courseId).filter((c) => !coverOnly.has(c)), from, to })).filter((o) => new Date(o.start) >= from && new Date(o.start) < to);
  const coveredCourses = [...new Set(coverIn.map((c) => c.courseId))];
  const coverKeys = new Set(coverIn.map((c) => occurrenceKey(c.eventId, c.occurrenceStart)));
  const coverOcc = coveredCourses.length ? (await occurrencesFor({ courseIds: coveredCourses, from, to })).filter((o) => coverKeys.has(occurrenceKey(o.eventId, o.occurrenceStart))) : [];
  return suggestEntries({
    own: own.map((o) => ({ ...o, title: `${o.courseName}: ${o.title}` })),
    coveredAway: new Set(coverAway.map((c) => occurrenceKey(c.eventId, c.occurrenceStart))),
    coveredIn: coverOcc.map((o) => ({ ...o, title: `${o.courseName}: ${o.title}` })),
    bookings,
  });
}

export type TimesheetView = Awaited<ReturnType<typeof getTimesheet>>;

/** A tutor's month: the sheet, its entries, suggestions not yet added, and their rate. */
export async function getTimesheet(viewer: Viewer, input: { month: string; membershipId?: string }) {
  const ws = staffOnly(viewer);
  checkMonth(input.month);
  const membershipId = input.membershipId ?? viewer.membership?.id;
  if (!membershipId) throw new ViewerError("FORBIDDEN");
  const as = await assertManages(viewer, membershipId, PERM);
  const sheet = await sheetFor(ws.id, membershipId, input.month);
  const [entries, suggested, rate, member] = await Promise.all([
    prisma.timesheetEntry.findMany({ where: { timesheetId: sheet.id }, orderBy: { startsAt: "asc" }, select: { id: true, kind: true, key: true, courseId: true, startsAt: true, minutes: true, label: true, note: true } }),
    suggestionsFor(ws.id, membershipId, input.month),
    prisma.payRate.findUnique({ where: { membershipId }, select: { hourlyCents: true } }),
    prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, select: { user: { select: { name: true } } } }),
  ]);
  const have = new Set(entries.map((e) => e.key).filter(Boolean));
  const minutes = entries.reduce((n, e) => n + e.minutes, 0);
  const hourly = sheet.hourlyCents ?? rate?.hourlyCents ?? null;
  return {
    month: input.month, membershipId, name: member.user.name, as, sheet,
    entries, suggestions: suggested.filter((s) => !have.has(s.key)),
    totals: { minutes, hours: Math.round((minutes / 60) * 100) / 100, hourlyCents: hourly, amountCents: hourly != null ? payCents(minutes, hourly) : null },
    editable: sheet.status === "DRAFT" || sheet.status === "REJECTED",
  };
}

async function editableSheet(viewer: Viewer, timesheetId: string) {
  const ws = staffOnly(viewer);
  const s = await prisma.timesheet.findUnique({ where: { id: timesheetId }, select: { id: true, workspaceId: true, membershipId: true, status: true, month: true } });
  if (!s || s.workspaceId !== ws.id) throw new UserError("That timesheet no longer exists.");
  await assertManages(viewer, s.membershipId, PERM);
  if (s.status !== "DRAFT" && s.status !== "REJECTED") throw new UserError("This timesheet has been submitted. Ask your manager to reopen it to change it.");
  return s;
}

async function retotal(timesheetId: string) {
  const sum = await prisma.timesheetEntry.aggregate({ where: { timesheetId }, _sum: { minutes: true } });
  await prisma.timesheet.update({ where: { id: timesheetId }, data: { totalMinutes: sum._sum.minutes ?? 0 } });
}

/** Adds suggested entries by key (or all of them). */
export async function addSuggestions(viewer: Viewer, input: { timesheetId: string; keys?: string[] }) {
  const s = await editableSheet(viewer, input.timesheetId);
  const all = await suggestionsFor(s.workspaceId, s.membershipId, s.month);
  const pick = input.keys ? all.filter((x) => input.keys!.includes(x.key)) : all;
  if (pick.length) {
    await prisma.timesheetEntry.createMany({
      data: pick.map((x) => ({ timesheetId: s.id, kind: x.kind, key: x.key, courseId: x.courseId, startsAt: x.startsAt, minutes: x.minutes, label: x.label.slice(0, 200), eventId: x.eventId, occurrenceStart: x.occurrenceStart, bookingId: x.bookingId })),
      skipDuplicates: true,
    });
    await retotal(s.id);
  }
  return { added: pick.length };
}

/** Other work (marking, preparation, a meeting), in minutes. */
export async function addManualEntry(viewer: Viewer, input: { timesheetId: string; startsAt: Date; minutes: number; label: string; courseId?: string | null; note?: string | null }) {
  const s = await editableSheet(viewer, input.timesheetId);
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > TIMESHEET_LIMITS.maxEntryMinutes) throw new UserError("Enter between 1 minute and 12 hours.");
  const { from, to } = monthRange(s.month, await zoneOf(s.workspaceId));
  if (input.startsAt < from || input.startsAt >= to) throw new UserError("That date isn't in this month.");
  if (input.courseId && !(await prisma.course.findFirst({ where: { id: input.courseId, workspaceId: s.workspaceId }, select: { id: true } }))) throw new UserError("That course isn't in this organisation.");
  const e = await prisma.timesheetEntry.create({
    data: { timesheetId: s.id, kind: "MANUAL", startsAt: input.startsAt, minutes: input.minutes, label: input.label.trim().slice(0, 200) || "Other work", courseId: input.courseId ?? null, note: input.note?.trim().slice(0, 300) || null },
    select: { id: true },
  });
  await retotal(s.id);
  return e;
}

export async function updateEntry(viewer: Viewer, input: { entryId: string; minutes?: number; note?: string | null; label?: string }) {
  const e = await prisma.timesheetEntry.findUnique({ where: { id: input.entryId }, select: { timesheetId: true, kind: true } });
  if (!e) throw new UserError("That entry no longer exists.");
  await editableSheet(viewer, e.timesheetId);
  if (input.minutes != null && (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > TIMESHEET_LIMITS.maxEntryMinutes)) throw new UserError("Enter between 1 minute and 12 hours.");
  await prisma.timesheetEntry.update({
    where: { id: input.entryId },
    data: {
      ...(input.minutes != null ? { minutes: input.minutes } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim().slice(0, 300) || null } : {}),
      ...(input.label && e.kind === "MANUAL" ? { label: input.label.trim().slice(0, 200) } : {}),
    },
  });
  await retotal(e.timesheetId);
  return { ok: true as const };
}

export async function removeEntry(viewer: Viewer, input: { entryId: string }) {
  const e = await prisma.timesheetEntry.findUnique({ where: { id: input.entryId }, select: { timesheetId: true } });
  if (!e) return { ok: true as const };
  await editableSheet(viewer, e.timesheetId);
  await prisma.timesheetEntry.delete({ where: { id: input.entryId } });
  await retotal(e.timesheetId);
  return { ok: true as const };
}

/** The tutor (or a manager for them) submits the month. */
export async function submitTimesheet(viewer: Viewer, input: { timesheetId: string }) {
  const s = await editableSheet(viewer, input.timesheetId);
  if (!canMove(s.status, "SUBMITTED", "tutor")) throw new UserError("This timesheet can't be submitted now.");
  if (!(await prisma.timesheetEntry.count({ where: { timesheetId: s.id } }))) throw new UserError("Add at least one entry first.");
  await prisma.timesheet.update({ where: { id: s.id }, data: { status: "SUBMITTED", submittedAt: new Date(), decisionNote: null } });
  return { ok: true as const };
}

/** Approve (snapshotting the rate and pay), reject with a note, or reopen an approved sheet. Managers only, never their own. */
export async function decideTimesheet(viewer: Viewer, input: { timesheetId: string; decision: "APPROVED" | "REJECTED" | "DRAFT"; note?: string | null }) {
  const ws = staffOnly(viewer);
  const s = await prisma.timesheet.findUnique({ where: { id: input.timesheetId }, select: { id: true, workspaceId: true, membershipId: true, status: true, totalMinutes: true } });
  if (!s || s.workspaceId !== ws.id) throw new UserError("That timesheet no longer exists.");
  if ((await assertManages(viewer, s.membershipId, PERM)) !== "manager") throw new ViewerError("FORBIDDEN");
  if (s.membershipId === viewer.membership?.id) throw new UserError("Someone else must approve your own timesheet.");
  if (!canMove(s.status, input.decision, "manager")) throw new UserError("This timesheet can't move to that state now.");
  if (input.decision === "REJECTED" && !input.note?.trim()) throw new UserError("Say what needs changing.");
  const rate = input.decision === "APPROVED" ? await prisma.payRate.findUnique({ where: { membershipId: s.membershipId }, select: { hourlyCents: true } }) : null;
  await prisma.timesheet.update({
    where: { id: s.id },
    data: {
      status: input.decision, decidedAt: new Date(), decidedById: viewer.user.id, decisionNote: input.note?.trim().slice(0, 500) || null,
      ...(input.decision === "APPROVED" ? { hourlyCents: rate?.hourlyCents ?? null, amountCents: rate ? payCents(s.totalMinutes, rate.hourlyCents) : null } : { hourlyCents: null, amountCents: null }),
    },
  });
  await prisma.auditLog.create({ data: { workspaceId: ws.id, actorUserId: viewer.user.id, action: `timesheet.${input.decision.toLowerCase()}`, targetType: "Timesheet", targetId: s.id, data: { minutes: s.totalMinutes } } });
  return { ok: true as const };
}

/** Sets a tutor's hourly rate (rand cents). Applies to timesheets approved from now on. */
export async function setPayRate(viewer: Viewer, input: { membershipId: string; hourlyCents: number }) {
  const ws = staffOnly(viewer);
  if ((await assertManages(viewer, input.membershipId, PERM)) !== "manager") throw new ViewerError("FORBIDDEN");
  if (!Number.isInteger(input.hourlyCents) || input.hourlyCents < 0 || input.hourlyCents > TIMESHEET_LIMITS.maxHourlyCents) throw new UserError("Enter an hourly rate from R0 to R10,000.");
  await prisma.payRate.upsert({
    where: { membershipId: input.membershipId },
    create: { membershipId: input.membershipId, workspaceId: ws.id, hourlyCents: input.hourlyCents, updatedById: viewer.user.id },
    update: { hourlyCents: input.hourlyCents, updatedById: viewer.user.id },
  });
  await prisma.auditLog.create({ data: { workspaceId: ws.id, actorUserId: viewer.user.id, action: "timesheet.rate", targetType: "Membership", targetId: input.membershipId, data: { hourlyCents: input.hourlyCents } } });
  return { ok: true as const };
}

/** The month's timesheets for the staff the manager covers (one row per tutor, even with no sheet yet). */
export async function listTimesheets(viewer: Viewer, input: { month: string; status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" }) {
  const ws = staffOnly(viewer);
  checkMonth(input.month);
  if (!viewer.permissions.includes(PERM)) throw new ViewerError("FORBIDDEN");
  const scope = await managedMemberships(viewer, PERM);
  const members = await prisma.membership.findMany({
    where: { workspaceId: ws.id, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "TUTOR"] }, ...(scope === "ALL" ? {} : { id: { in: scope } }) },
    select: { id: true, user: { select: { name: true, email: true } }, payRate: { select: { hourlyCents: true } }, timesheets: { where: { month: input.month }, select: { id: true, status: true, totalMinutes: true, amountCents: true, submittedAt: true } } },
  });
  return members
    .map((m) => {
      const t = m.timesheets[0];
      return { membershipId: m.id, name: m.user.name, email: m.user.email, hourlyCents: m.payRate?.hourlyCents ?? null, timesheetId: t?.id ?? null, status: t?.status ?? "DRAFT", totalMinutes: t?.totalMinutes ?? 0, amountCents: t?.amountCents ?? null, submittedAt: t?.submittedAt ?? null };
    })
    .filter((r) => !input.status || r.status === input.status)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Payroll CSV for approved timesheets in a month: one row per tutor, or one per entry with `detail`. */
export async function payrollCsv(viewer: Viewer, input: { month: string; detail?: boolean }): Promise<{ fileName: string; csv: string }> {
  const ws = staffOnly(viewer);
  checkMonth(input.month);
  if (!viewer.permissions.includes(PERM)) throw new ViewerError("FORBIDDEN");
  const scope = await managedMemberships(viewer, PERM);
  const sheets = await prisma.timesheet.findMany({
    where: { workspaceId: ws.id, month: input.month, status: "APPROVED", ...(scope === "ALL" ? {} : { membershipId: { in: scope } }) },
    orderBy: { membership: { user: { name: "asc" } } },
    select: {
      totalMinutes: true, hourlyCents: true, amountCents: true, decidedAt: true,
      membership: { select: { user: { select: { name: true, email: true } } } },
      entries: input.detail ? { orderBy: { startsAt: "asc" }, select: { kind: true, startsAt: true, minutes: true, label: true, note: true } } : false,
    },
  });
  const rand = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));
  const name = `payroll-${input.month}${input.detail ? "-detail" : ""}.csv`;
  if (!input.detail) {
    return {
      fileName: name,
      csv: toCsv(["Tutor", "Email", "Month", "Hours", "Hourly rate (R)", "Amount (R)", "Approved on"], sheets.map((s) => [
        s.membership.user.name, s.membership.user.email, input.month, (s.totalMinutes / 60).toFixed(2), rand(s.hourlyCents), rand(s.amountCents), s.decidedAt?.toISOString().slice(0, 10) ?? "",
      ])),
    };
  }
  const rows: unknown[][] = [];
  for (const s of sheets) for (const e of (s.entries as Array<{ kind: string; startsAt: Date; minutes: number; label: string; note: string | null }>)) {
    rows.push([s.membership.user.name, s.membership.user.email, e.startsAt.toISOString(), e.kind, e.label, e.note ?? "", e.minutes, rand(s.hourlyCents), rand(s.hourlyCents != null ? payCents(e.minutes, s.hourlyCents) : null)]);
  }
  return { fileName: name, csv: toCsv(["Tutor", "Email", "When", "Kind", "What", "Note", "Minutes", "Hourly rate (R)", "Amount (R)"], rows) };
}
