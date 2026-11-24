/**
 * An organisation's enquiry pipeline (#216 phase 3): families asking about
 * lessons, from a public form (/enquire/<slug>, off until the owner switches
 * it on) or entered by staff, moved through NEW → CONTACTED → TRIAL →
 * ENROLLED or LOST, with notes, emails to the enquirer and follow-up
 * reminders. Staff with `enquiries.manage`; branch roles see their
 * branches' enquiries and unassigned ones. Contract: viewer.md, "Enquiry
 * pipeline". Not PlatformEnquiry (enquiries to Nexa itself).
 */

import "server-only";

import { z } from "zod";

import { hashIp } from "@/features/marketing/enquiries";
import { looksLikeSpam, screenEnquiry } from "@/features/marketing/enquiry-rules";
import { emitNotification } from "@/features/notifications/server";
import type { EnquiryStage, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import { effectiveRole } from "@/lib/roles";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can, staffScope } from "@/lib/viewer-core";

const PERM = "enquiries.manage" as const;
export const ENQUIRY_SOURCES = ["FORM", "MANUAL", "REFERRAL", "IMPORT", "PHONE", "WALK_IN", "SOCIAL", "OTHER"] as const;
export const STAGES: readonly EnquiryStage[] = ["NEW", "CONTACTED", "TRIAL", "ENROLLED", "LOST"];
const LIMITS = { perIpHour: 5, perEmailDay: 3 };

/* ------------------------------------------------------------------------- */
/* Public form                                                               */
/* ------------------------------------------------------------------------- */

/** What the public page needs, or null when the form is off or the slug unknown. */
export async function enquiryFormFor(slug: string) {
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, accentColor: true, enquiryFormOn: true, kind: true, branches: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  if (!ws || !ws.enquiryFormOn) return null;
  return { name: ws.name, logoUrl: ws.logoUrl, accentColor: ws.accentColor, branches: ws.branches };
}

export const publicEnquirySchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(2, "Please give your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please give a valid email address.").max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(40).regex(/^[+()\d\s-]{7,40}$/, "Please give a valid phone number.").optional().or(z.literal("").transform(() => undefined)),
  studentName: z.string().trim().max(120).optional(),
  gradeLevel: z.coerce.number().int().min(0).max(13).optional().catch(undefined),
  subjects: z.array(z.string().trim().max(60)).max(10).default([]),
  message: z.string().trim().max(4000).optional(),
  branchId: z.string().max(64).optional(),
  startedAt: z.coerce.number().int().optional(),
  website: z.string().optional(),
}).refine((v) => v.email || v.phone, { message: "Give an email address or a phone number so they can reach you.", path: ["email"] });

/** The public form. Bots and spam get the same answer but are dropped. Tells the organisation's enquiry managers. */
export async function submitWorkspaceEnquiry(input: z.output<typeof publicEnquirySchema>, ip: string, now: Date = new Date()) {
  const ws = await prisma.workspace.findUnique({ where: { slug: input.slug }, select: { id: true, name: true, enquiryFormOn: true } });
  if (!ws?.enquiryFormOn) throw new UserError("This organisation isn't taking enquiries online. Contact them directly.");
  const screen = screenEnquiry(input, now.getTime());
  if (screen === "stale") throw new UserError("This form has been open a long time. Please reload the page and try again.");
  if (screen === "bot" || looksLikeSpam(input.message ?? "")) return { ok: true as const };
  const ipHash = hashIp(ip || "unknown");
  const [byIp, byEmail] = await Promise.all([
    prisma.workspaceEnquiry.count({ where: { ipHash, createdAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
    input.email ? prisma.workspaceEnquiry.count({ where: { workspaceId: ws.id, email: input.email, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }) : 0,
  ]);
  if (byIp >= LIMITS.perIpHour || byEmail >= LIMITS.perEmailDay) throw new UserError("We've already received your enquiry. They'll be in touch soon.");
  const branchId = input.branchId && (await prisma.branch.findFirst({ where: { id: input.branchId, workspaceId: ws.id }, select: { id: true } })) ? input.branchId : null;
  const row = await prisma.workspaceEnquiry.create({
    data: {
      workspaceId: ws.id, name: input.name, email: input.email ?? null, phone: input.phone ?? null, studentName: input.studentName || null,
      gradeLevel: input.gradeLevel ?? null, subjects: input.subjects.filter(Boolean), message: input.message || null, source: "FORM", branchId, ipHash, nextFollowUpAt: new Date(now.getTime() + 86_400_000),
    },
    select: { id: true },
  });
  await notifyManagers(ws.id, branchId, `New enquiry: ${input.name}`, input.studentName ? `About ${input.studentName}${input.gradeLevel ? `, grade ${input.gradeLevel}` : ""}.` : "From the online form.", row.id);
  return { ok: true as const };
}

/** In-app note to everyone who manages enquiries for that branch (or the whole organisation). */
async function notifyManagers(workspaceId: string, branchId: string | null, title: string, message: string, enquiryId: string) {
  const members = await prisma.membership.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { userId: true, role: true, presetRole: true, customRole: { select: { id: true, name: true, permissions: true, scope: true } }, branchIds: true } });
  const ids = members.filter((m) => {
    const r = effectiveRole({ role: m.role, presetRole: m.presetRole, customRole: m.customRole ?? null });
    if (!r.permissions.includes(PERM)) return false;
    return r.scope === "WORKSPACE" || (r.scope === "BRANCHES" && (!branchId || m.branchIds.includes(branchId)));
  }).map((m) => m.userId);
  if (ids.length) await emitNotification({ title: title.slice(0, 200), message, type: "SYSTEM", userIds: ids, link: `/dashboard/enquiries/${enquiryId}` }, { revalidate: false, email: true }).catch(() => undefined);
}

/* ------------------------------------------------------------------------- */
/* Staff                                                                     */
/* ------------------------------------------------------------------------- */

function manager(viewer: Viewer) {
  if (!viewer.workspace || (viewer.persona !== "staff" && viewer.persona !== "admin") || !can(viewer, PERM)) throw new ViewerError("FORBIDDEN");
  return viewer.workspace.id;
}

/** Branch roles see their branches' enquiries and unbranched ones; own-course roles see those assigned to them. */
function scopeWhere(viewer: Viewer): Prisma.WorkspaceEnquiryWhereInput {
  if (viewer.persona === "admin") return {};
  const s = staffScope(viewer);
  if (s === "WORKSPACE") return {};
  if (s === "BRANCHES") return { OR: [{ branchId: null }, { branchId: { in: viewer.membership?.branchIds ?? [] } }] };
  return { assignedMembershipId: viewer.membership?.id ?? "-" };
}

async function load(viewer: Viewer, id: string) {
  const workspaceId = manager(viewer);
  const e = await prisma.workspaceEnquiry.findFirst({ where: { AND: [{ id, workspaceId }, scopeWhere(viewer)] } });
  if (!e) throw new UserError("That enquiry no longer exists.");
  return e;
}

export const enquiryInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  studentName: z.string().trim().max(120).nullable().optional(),
  gradeLevel: z.number().int().min(0).max(13).nullable().optional(),
  subjects: z.array(z.string().trim().max(60)).max(10).optional(),
  message: z.string().trim().max(4000).nullable().optional(),
  source: z.enum(ENQUIRY_SOURCES).optional(),
  branchId: z.string().max(64).nullable().optional(),
  assignedMembershipId: z.string().max(64).nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});
export type EnquiryInput = z.input<typeof enquiryInput>;

async function checkRefs(workspaceId: string, input: { branchId?: string | null; assignedMembershipId?: string | null }) {
  if (input.branchId && !(await prisma.branch.findFirst({ where: { id: input.branchId, workspaceId }, select: { id: true } }))) throw new UserError("That branch isn't in this organisation.");
  if (input.assignedMembershipId && !(await prisma.membership.findFirst({ where: { id: input.assignedMembershipId, workspaceId, status: "ACTIVE" }, select: { id: true } }))) throw new UserError("That person isn't in this organisation.");
}

export async function createEnquiry(viewer: Viewer, raw: EnquiryInput) {
  const workspaceId = manager(viewer);
  const input = enquiryInput.parse(raw);
  await checkRefs(workspaceId, input);
  const row = await prisma.workspaceEnquiry.create({
    data: {
      workspaceId, name: input.name, email: input.email ?? null, phone: input.phone ?? null, studentName: input.studentName ?? null, gradeLevel: input.gradeLevel ?? null,
      subjects: input.subjects ?? [], message: input.message ?? null, source: input.source ?? "MANUAL", branchId: input.branchId ?? null,
      assignedMembershipId: input.assignedMembershipId ?? viewer.membership?.id ?? null, nextFollowUpAt: input.nextFollowUpAt ?? null,
    },
    select: { id: true },
  });
  return row;
}

export async function updateEnquiry(viewer: Viewer, input: { id: string } & Partial<EnquiryInput>) {
  const e = await load(viewer, input.id);
  const { id, ...rest } = input;
  const data = enquiryInput.partial().parse(rest);
  await checkRefs(e.workspaceId, data);
  await prisma.workspaceEnquiry.update({
    where: { id },
    data: { ...data, ...(data.nextFollowUpAt !== undefined ? { followUpRemindedAt: null } : {}) },
  });
  return { ok: true as const };
}

/** Moves the stage; LOST needs a reason, ENROLLED may link the learner. Logged as a note. */
export async function moveEnquiry(viewer: Viewer, input: { id: string; stage: EnquiryStage; lostReason?: string | null; learnerId?: string | null }) {
  const e = await load(viewer, input.id);
  if (input.stage === "LOST" && !input.lostReason?.trim()) throw new UserError("Say why it was lost (for example price, timing, or went elsewhere).");
  if (input.learnerId && !(await prisma.learner.findFirst({ where: { id: input.learnerId, workspaceId: e.workspaceId }, select: { id: true } }))) throw new UserError("That student isn't in this organisation.");
  const now = new Date();
  await prisma.$transaction([
    prisma.workspaceEnquiry.update({
      where: { id: e.id },
      data: {
        stage: input.stage, stageChangedAt: now, lostReason: input.stage === "LOST" ? input.lostReason!.trim().slice(0, 300) : null,
        learnerId: input.stage === "ENROLLED" ? input.learnerId ?? e.learnerId : e.learnerId,
        ...(input.stage === "ENROLLED" || input.stage === "LOST" ? { nextFollowUpAt: null } : {}),
      },
    }),
    prisma.enquiryNote.create({ data: { enquiryId: e.id, authorUserId: viewer.user.id, kind: "STAGE", body: `${e.stage} → ${input.stage}${input.stage === "LOST" ? `: ${input.lostReason!.trim()}` : ""}`.slice(0, 4000) } }),
  ]);
  return { ok: true as const };
}

export async function addEnquiryNote(viewer: Viewer, input: { id: string; body: string }) {
  const e = await load(viewer, input.id);
  if (!input.body.trim()) throw new UserError("Write a note first.");
  return prisma.enquiryNote.create({ data: { enquiryId: e.id, authorUserId: viewer.user.id, kind: "NOTE", body: input.body.trim().slice(0, 4000) }, select: { id: true, createdAt: true } });
}

/**
 * Emails the enquirer from Nexa, with Reply-To set to the staff member, and
 * logs it as a note. Staff write every word; nothing goes out automatically.
 */
export async function emailEnquirer(viewer: Viewer, input: { id: string; subject: string; body: string }) {
  const e = await load(viewer, input.id);
  if (!e.email) throw new UserError("This enquiry has no email address.");
  if (input.subject.trim().length < 3 || input.body.trim().length < 10) throw new UserError("Write a subject and a message.");
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: e.workspaceId }, select: { name: true } });
  const now = new Date();
  const key = `enquiry:reply:${e.id}:${now.getTime()}`;
  await enqueueEmail(prisma, {
    key, template: "enquiry:reply", to: e.email, workspaceId: e.workspaceId, category: "enquiry",
    data: { recipientName: e.name, workspaceName: ws.name, staffName: viewer.user.name, staffEmail: viewer.user.email, subject: input.subject.trim().slice(0, 150), body: input.body.trim().slice(0, 6000) },
  });
  const sent = await sendQueuedNow([key]).catch(() => []);
  await prisma.$transaction([
    prisma.enquiryNote.create({ data: { enquiryId: e.id, authorUserId: viewer.user.id, kind: "EMAIL", body: `${input.subject.trim()}\n\n${input.body.trim()}`.slice(0, 4000) } }),
    ...(e.stage === "NEW" ? [prisma.workspaceEnquiry.update({ where: { id: e.id }, data: { stage: "CONTACTED", stageChangedAt: now } })] : []),
  ]);
  return { ok: true as const, outcome: sent[0]?.outcome ?? "queued" };
}

export async function getEnquiry(viewer: Viewer, input: { id: string }) {
  const e = await load(viewer, input.id);
  const notes = await prisma.enquiryNote.findMany({ where: { enquiryId: e.id }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, body: true, createdAt: true, authorUserId: true } });
  const authors = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(notes.map((n) => n.authorUserId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return { ...e, ipHash: undefined, notes: notes.map((n) => ({ ...n, author: n.authorUserId ? authors.get(n.authorUserId) ?? null : null, authorUserId: undefined })) };
}

/** The board: enquiries in scope, filtered, newest first; and counts per stage. */
export async function listEnquiries(viewer: Viewer, input: { stage?: EnquiryStage; assigned?: "me" | "none"; branchId?: string; q?: string; dueOnly?: boolean; limit?: number }) {
  const workspaceId = manager(viewer);
  const where: Prisma.WorkspaceEnquiryWhereInput = {
    AND: [
      { workspaceId }, scopeWhere(viewer),
      ...(input.stage ? [{ stage: input.stage }] : []),
      ...(input.assigned === "me" ? [{ assignedMembershipId: viewer.membership?.id ?? "-" }] : input.assigned === "none" ? [{ assignedMembershipId: null }] : []),
      ...(input.branchId ? [{ branchId: input.branchId }] : []),
      ...(input.dueOnly ? [{ nextFollowUpAt: { lte: new Date() } }] : []),
      ...(input.q?.trim() ? [{ OR: [{ name: { contains: input.q.trim(), mode: "insensitive" as const } }, { studentName: { contains: input.q.trim(), mode: "insensitive" as const } }, { email: { contains: input.q.trim(), mode: "insensitive" as const } }, { phone: { contains: input.q.trim() } }] }] : []),
    ],
  };
  const [items, counts] = await Promise.all([
    prisma.workspaceEnquiry.findMany({ where, orderBy: [{ createdAt: "desc" }], take: Math.min(Math.max(input.limit ?? 100, 1), 300), select: { id: true, name: true, studentName: true, gradeLevel: true, subjects: true, source: true, stage: true, branchId: true, assignedMembershipId: true, nextFollowUpAt: true, createdAt: true, stageChangedAt: true, email: true, phone: true } }),
    prisma.workspaceEnquiry.groupBy({ by: ["stage"], where: { AND: [{ workspaceId }, scopeWhere(viewer)] }, _count: true }),
  ]);
  return { items, counts: Object.fromEntries(STAGES.map((s) => [s, counts.find((c) => c.stage === s)?._count ?? 0])) as Record<EnquiryStage, number> };
}

/** For the business dashboard: enquiries in a period by source and outcome, and the conversion rate. */
export async function enquiryFunnel(viewer: Viewer, input: { from: Date; to: Date }) {
  const workspaceId = manager(viewer);
  const rows = await prisma.workspaceEnquiry.findMany({ where: { AND: [{ workspaceId, createdAt: { gte: input.from, lt: input.to } }, scopeWhere(viewer)] }, select: { source: true, stage: true, createdAt: true, stageChangedAt: true, lostReason: true } });
  const by = <K extends string>(f: (r: (typeof rows)[number]) => K) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {} as Record<K, number>);
  const enrolled = rows.filter((r) => r.stage === "ENROLLED");
  const days = enrolled.map((r) => (r.stageChangedAt.getTime() - r.createdAt.getTime()) / 86_400_000);
  return {
    total: rows.length,
    byStage: by((r) => r.stage),
    bySource: by((r) => r.source),
    conversionRate: rows.length ? Math.round((enrolled.length / rows.length) * 1000) / 10 : null,
    medianDaysToEnrol: days.length ? Math.round(days.sort((a, b) => a - b)[Math.floor(days.length / 2)] * 10) / 10 : null,
    lostReasons: by((r) => (r.stage === "LOST" ? (r.lostReason ?? "Not given").slice(0, 60) : "")),
  };
}

export async function setEnquiryForm(viewer: Viewer, input: { on: boolean }) {
  if (!viewer.workspace || !can(viewer, "workspace.settings")) throw new ViewerError("FORBIDDEN");
  const ws = await prisma.workspace.update({ where: { id: viewer.workspace.id }, data: { enquiryFormOn: input.on }, select: { slug: true, enquiryFormOn: true } });
  return { on: ws.enquiryFormOn, path: `/enquire/${ws.slug}` };
}

/** Housekeeping: reminds the assigned person (in-app and email) once when a follow-up falls due. */
export async function remindEnquiryFollowUps(now: Date = new Date()): Promise<number> {
  const due = await prisma.workspaceEnquiry.findMany({
    where: { nextFollowUpAt: { lte: now }, followUpRemindedAt: null, assignedMembershipId: { not: null }, stage: { in: ["NEW", "CONTACTED", "TRIAL"] } },
    take: 500,
    select: { id: true, name: true, studentName: true, assignedMembershipId: true },
  });
  let n = 0;
  for (const e of due) {
    const m = await prisma.membership.findUnique({ where: { id: e.assignedMembershipId! }, select: { userId: true, status: true } });
    if (m?.status === "ACTIVE") {
      await emitNotification({ title: `Follow up: ${e.name}`.slice(0, 200), message: e.studentName ? `About ${e.studentName}.` : "An enquiry is due for a follow-up.", type: "SYSTEM", userIds: [m.userId], link: `/dashboard/enquiries/${e.id}` }, { revalidate: false, email: true }).catch(() => undefined);
      n++;
    }
    await prisma.workspaceEnquiry.update({ where: { id: e.id }, data: { followUpRemindedAt: now } });
  }
  return n;
}

/** Housekeeping: enquiries untouched for 24 months are deleted (personal data kept no longer than needed). */
export async function pruneOldEnquiries(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.workspaceEnquiry.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 730 * 86_400_000) } } });
  return count;
}
