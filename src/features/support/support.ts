/**
 * Help and contact centre (owner 24 Nov). Rules: ./support-rules.ts.
 * Contract: docs/revamp/contracts/support.md.
 *
 * A query goes to Nexa or to the requester's organisation. Organisation
 * queries are seen by staff with `enquiries.manage` in scope and by the
 * tutors of the query's course; Nexa queries by Nexa admins. A requester
 * sees only their own queries, and never internal notes.
 */

import "server-only";

import { randomBytes } from "node:crypto";

import { emitNotification } from "@/features/notifications/server";
import { hashIp } from "@/features/marketing/enquiries";
import { looksLikeSpam, screenEnquiry } from "@/features/marketing/enquiry-rules";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { NEXA_INBOX } from "@/lib/email/config";
import { enqueueEmail, sendQueuedNow } from "@/lib/email/queue";
import { effectiveRole } from "@/lib/roles";
import { UserError } from "@/lib/user-error";
import { can, scopedCourseWhere, staffScope } from "@/lib/viewer-core";
import { ViewerError, type Viewer } from "@/lib/viewer";

import {
  cleanAttachments,
  cleanPagePath,
  defaultRoute,
  formatRef,
  publicQuerySchema,
  querySchema,
  replySchema,
  statusAfterMessage,
  SUPPORT_LIMITS,
  TOPIC_LABEL,
  type SupportPersona,
  type SupportRoute,
  type SupportStatus,
  type SupportTopic,
} from "./support-rules";
import type { z } from "zod";

const PERM = "enquiries.manage" as const;
const DAY = 86_400_000;

function inbox(): string {
  return NEXA_INBOX;
}

function personaOf(viewer: Viewer): SupportPersona {
  if (viewer.persona === "learner" || viewer.persona === "guardian" || viewer.persona === "staff" || viewer.persona === "admin") return viewer.persona;
  return "learner";
}

/* ------------------------------------------------------------------------- */
/* The requester's organisations and courses                                  */
/* ------------------------------------------------------------------------- */

type Org = { id: string; name: string };
type CourseOption = { id: string; name: string; workspaceId: string; forName: string | null };

/** For a student or parent: the organisations and courses they (or their children) learn in. */
async function requesterScope(viewer: Viewer): Promise<{ organisations: Org[]; courses: CourseOption[] }> {
  const persona = personaOf(viewer);
  if (persona !== "learner" && persona !== "guardian") return { organisations: [], courses: [] };
  const people = persona === "learner" ? [{ userId: viewer.user.id, name: null as string | null }] : viewer.children.map((c) => ({ userId: c.userId, name: c.name }));
  if (people.length === 0) return { organisations: [], courses: [] };
  const learners = await prisma.learner.findMany({
    where: { userId: { in: people.map((p) => p.userId) }, status: "ACTIVE" },
    select: {
      userId: true,
      workspace: { select: { id: true, name: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { course: { select: { id: true, name: true, workspaceId: true } } } },
    },
  });
  const orgs = new Map<string, Org>();
  const courses = new Map<string, CourseOption>();
  for (const l of learners) {
    orgs.set(l.workspace.id, { id: l.workspace.id, name: l.workspace.name });
    const forName = persona === "guardian" ? people.find((p) => p.userId === l.userId)?.name ?? null : null;
    for (const e of l.enrollments) if (!courses.has(e.course.id)) courses.set(e.course.id, { id: e.course.id, name: e.course.name, workspaceId: e.course.workspaceId ?? l.workspace.id, forName });
  }
  return {
    organisations: [...orgs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    courses: [...courses.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function helpContext(viewer: Viewer) {
  const persona = personaOf(viewer);
  const scope = await requesterScope(viewer);
  return {
    persona,
    organisations: scope.organisations,
    courses: scope.courses,
    /** The default for a class question; the form recomputes it as the topic changes. */
    suggestedRoute: defaultRoute(persona, "CLASSES", scope.organisations.length > 0),
    canSeeOrganisationInbox: (await staffAccess(viewer)) !== null,
    isNexaAdmin: viewer.persona === "admin",
  };
}

/* ------------------------------------------------------------------------- */
/* Who sees what                                                              */
/* ------------------------------------------------------------------------- */

/**
 * A staff member's view of their organisation's queries, as a filter, or
 * null when they see none. Handle-enquiries roles see by scope; anyone who
 * teaches a course sees queries about it.
 */
async function staffAccess(viewer: Viewer): Promise<Prisma.SupportQueryWhereInput | null> {
  if (viewer.persona !== "staff" || !viewer.workspace || !viewer.membership) return null;
  const workspaceId = viewer.workspace.id;
  const handles = can(viewer, PERM);
  const scope = staffScope(viewer);
  if (handles && scope === "WORKSPACE") return { route: "WORKSPACE", workspaceId };
  const branchIds = handles && scope === "BRANCHES" ? viewer.membership.branchIds ?? [] : [];
  const courses = await prisma.course.findMany({
    where: { workspaceId, ...scopedCourseWhere({ membershipId: viewer.membership.id, branchIds }) },
    select: { id: true },
  });
  const or: Prisma.SupportQueryWhereInput[] = [];
  if (courses.length) or.push({ courseId: { in: courses.map((c) => c.id) } });
  if (handles && scope === "BRANCHES") or.push({ courseId: null });
  if (!or.length) return null;
  return { route: "WORKSPACE", workspaceId, OR: or };
}

type Access = "requester" | "staff" | "nexa";

/** How the viewer relates to a query, or null if they can't see it. */
async function accessTo(viewer: Viewer, queryId: string): Promise<Access | null> {
  const q = await prisma.supportQuery.findUnique({ where: { id: queryId }, select: { requesterUserId: true, route: true } });
  if (!q) return null;
  if (q.requesterUserId === viewer.user.id) return "requester";
  if (viewer.persona === "admin") return "nexa";
  const where = await staffAccess(viewer);
  if (!where) return null;
  const hit = await prisma.supportQuery.count({ where: { AND: [{ id: queryId }, where] } });
  return hit ? "staff" : null;
}

/** The people to tell about a new organisation query (or a requester's reply to one). */
async function organisationRecipients(workspaceId: string, courseId: string | null): Promise<string[]> {
  const [members, course] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, userId: true, role: true, presetRole: true, branchIds: true, customRole: { select: { id: true, name: true, permissions: true, scope: true } } },
    }),
    courseId
      ? prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { ownerMembershipId: true, team: { select: { branchId: true } }, staff: { select: { membershipId: true } } } })
      : null,
  ]);
  const teaching = new Set<string>([...(course?.ownerMembershipId ? [course.ownerMembershipId] : []), ...(course?.staff.map((s) => s.membershipId) ?? [])]);
  const branchId = course?.team?.branchId ?? null;
  const ids = new Set<string>();
  for (const m of members) {
    if (teaching.has(m.id)) { ids.add(m.userId); continue; }
    const r = effectiveRole({ role: m.role, presetRole: m.presetRole, customRole: m.customRole ?? null });
    if (!r.permissions.includes(PERM)) continue;
    if (r.scope === "WORKSPACE" || (r.scope === "BRANCHES" && (!courseId || (branchId && m.branchIds.includes(branchId))))) ids.add(m.userId);
  }
  // A small organisation with nobody handling queries: its owners.
  if (ids.size === 0) for (const m of members) if (m.role === "OWNER") ids.add(m.userId);
  return [...ids];
}

async function nexaAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true }, take: 50 });
  return admins.map((a) => a.id);
}

/* ------------------------------------------------------------------------- */
/* Telling people                                                             */
/* ------------------------------------------------------------------------- */

type Q = { id: string; number: number; subject: string; route: SupportRoute; workspaceId: string | null; courseId: string | null; requesterUserId: string | null; requesterName: string; requesterEmail: string; topic: SupportTopic; accessToken: string | null };

const qSelect = { id: true, number: true, subject: true, route: true, workspaceId: true, courseId: true, requesterUserId: true, requesterName: true, requesterEmail: true, topic: true, accessToken: true } as const;

async function tellAnswerers(q: Q, event: "new" | "reply", preview: string) {
  const ref = formatRef(q.number);
  const title = event === "new" ? `New query ${ref}: ${q.subject}` : `${q.requesterName} replied on ${ref}`;
  const message = `${TOPIC_LABEL[q.topic]}. ${preview.slice(0, 160)}`;
  if (q.route === "WORKSPACE" && q.workspaceId) {
    const ids = await organisationRecipients(q.workspaceId, q.courseId);
    if (ids.length) await emitNotification({ title: title.slice(0, 200), message, type: "MESSAGE", userIds: ids, link: `/dashboard/help/${q.id}` }, { revalidate: false, email: true }).catch(() => undefined);
    return;
  }
  const ids = await nexaAdminIds();
  if (ids.length) await emitNotification({ title: title.slice(0, 200), message, type: "SYSTEM", userIds: ids, link: `/dashboard/help/${q.id}` }, { revalidate: false, email: false }).catch(() => undefined);
  const key = `support:${event}:${q.id}:${Date.now()}`;
  await enqueueEmail(prisma, {
    key, template: "support:staff", to: inbox(), category: "support",
    data: { ref, subject: q.subject, topic: TOPIC_LABEL[q.topic], name: q.requesterName, email: q.requesterEmail, event, preview: preview.slice(0, 2000), link: `/dashboard/help/${q.id}` },
  });
  await sendQueuedNow([key]).catch(() => undefined);
}

async function tellRequester(q: Q, event: "received" | "answered", preview: string, answeredBy: string) {
  const ref = formatRef(q.number);
  if (q.requesterUserId) {
    if (event === "answered") {
      await emitNotification(
        { title: `Reply to your query ${ref}`.slice(0, 200), message: `${answeredBy}: ${preview.slice(0, 160)}`, type: "MESSAGE", userIds: [q.requesterUserId], link: `/dashboard/help/${q.id}` },
        { revalidate: false, email: true },
      ).catch(() => undefined);
    }
    return;
  }
  // Public requester: email only, with their private link.
  if (!q.accessToken) return;
  const key = `support:${event}:${q.id}:${Date.now()}`;
  await enqueueEmail(prisma, {
    key, template: "support:requester", to: q.requesterEmail, category: "support",
    data: { ref, subject: q.subject, name: q.requesterName, event, preview: preview.slice(0, 2000), answeredBy, link: `/support/q/${q.accessToken}` },
  });
  await sendQueuedNow([key]).catch(() => undefined);
}

/* ------------------------------------------------------------------------- */
/* Asking                                                                     */
/* ------------------------------------------------------------------------- */

export async function submitQuery(viewer: Viewer, raw: z.input<typeof querySchema>, meta: { userAgent?: string | null } = {}) {
  const input = querySchema.parse(raw);
  const persona = personaOf(viewer);
  const now = new Date();
  const recent = await prisma.supportQuery.count({ where: { requesterUserId: viewer.user.id, createdAt: { gte: new Date(now.getTime() - DAY) } } });
  if (recent >= SUPPORT_LIMITS.perUserDay) throw new UserError("You've sent a lot of queries today. Add to one of your open queries instead, or try again tomorrow.");

  const scope = await requesterScope(viewer);
  let route: SupportRoute = persona === "learner" || persona === "guardian" ? input.route ?? defaultRoute(persona, input.topic, scope.organisations.length > 0) : "NEXA";
  let workspaceId: string | null = null;
  let courseId: string | null = null;

  if (input.courseId) {
    const c = scope.courses.find((x) => x.id === input.courseId);
    if (!c) throw new UserError("Choose one of your own classes.");
    courseId = c.id;
    workspaceId = c.workspaceId;
  }
  if (route === "WORKSPACE") {
    const wanted = input.workspaceId ?? workspaceId ?? (scope.organisations.length === 1 ? scope.organisations[0].id : null);
    if (!wanted) throw new UserError("Choose which tutor or school should answer.");
    if (!scope.organisations.some((o) => o.id === wanted)) throw new UserError("Choose one of your own tutors or schools.");
    if (workspaceId && workspaceId !== wanted) throw new UserError("That class belongs to a different tutor or school.");
    workspaceId = wanted;
  } else if (persona === "staff" && viewer.workspace) {
    workspaceId = viewer.workspace.id; // context for Nexa: which organisation is asking
  }
  if (route === "WORKSPACE" && !workspaceId) route = "NEXA";

  const attachments = cleanAttachments(input.attachments, viewer.user.id);
  const q = await prisma.supportQuery.create({
    data: {
      kind: input.kind, topic: input.topic, route, workspaceId, courseId,
      requesterUserId: viewer.user.id, requesterName: viewer.user.name.slice(0, 120), requesterEmail: viewer.user.email, requesterPersona: persona,
      subject: input.subject, pagePath: cleanPagePath(input.pagePath), userAgent: meta.userAgent?.slice(0, 300) ?? null,
      requesterReadAt: now,
      messages: { create: { authorUserId: viewer.user.id, authorName: viewer.user.name.slice(0, 120), fromStaff: false, body: input.message, attachments } },
    },
    select: qSelect,
  });
  await tellAnswerers(q, "new", input.message);
  return { id: q.id, ref: formatRef(q.number), route: q.route };
}

/** The public form: same screen as the landing-page enquiry; a confirmation with a private link. */
export async function submitPublicQuery(raw: z.input<typeof publicQuerySchema>, ip: string, meta: { userAgent?: string | null } = {}, now = new Date()) {
  const input = publicQuerySchema.parse(raw);
  const screen = screenEnquiry({ startedAt: input.startedAt, website: input.website }, now.getTime());
  if (screen === "stale") throw new UserError("This form has been open a long time. Reload the page and try again.");
  if (screen === "bot" || looksLikeSpam(input.message)) return { ok: true as const };
  const ipHash = hashIp(ip || "unknown");
  const [byIp, byEmail] = await Promise.all([
    prisma.supportQuery.count({ where: { ipHash, createdAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
    prisma.supportQuery.count({ where: { requesterEmail: input.email, requesterUserId: null, createdAt: { gte: new Date(now.getTime() - DAY) } } }),
  ]);
  if (byIp >= SUPPORT_LIMITS.perIpHour || byEmail >= SUPPORT_LIMITS.perEmailDay) {
    throw new UserError("We've already received your query. Check your email for the link to it; we'll answer there.");
  }
  const q = await prisma.supportQuery.create({
    data: {
      kind: input.kind, topic: input.topic, route: "NEXA",
      requesterName: input.name, requesterEmail: input.email, requesterPersona: "public",
      subject: input.subject, pagePath: cleanPagePath(input.pagePath), userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipHash, accessToken: randomBytes(24).toString("hex"), requesterReadAt: now,
      messages: { create: { authorName: input.name, fromStaff: false, body: input.message } },
    },
    select: qSelect,
  });
  await tellRequester(q, "received", input.message, "");
  await tellAnswerers(q, "new", input.message);
  return { ok: true as const };
}

/* ------------------------------------------------------------------------- */
/* Reading                                                                    */
/* ------------------------------------------------------------------------- */

export type QueryListItem = {
  id: string; ref: string; kind: string; topic: SupportTopic; subject: string; status: SupportStatus; route: SupportRoute;
  organisationName: string | null; courseName: string | null; requesterName: string; requesterPersona: string;
  lastActivityAt: Date; createdAt: Date; unread: boolean;
};

async function toListItems(rows: Array<{ id: string; number: number; kind: string; topic: SupportTopic; subject: string; status: SupportStatus; route: SupportRoute; workspace: { name: string } | null; courseId: string | null; requesterName: string; requesterPersona: string; lastActivityAt: Date; createdAt: Date; requesterReadAt: Date | null; staffReadAt: Date | null }>, side: "requester" | "staff"): Promise<QueryListItem[]> {
  const courseIds = [...new Set(rows.map((r) => r.courseId).filter((x): x is string => !!x))];
  const courses = courseIds.length ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(courses.map((c) => [c.id, c.name]));
  return rows.map((r) => {
    const read = side === "requester" ? r.requesterReadAt : r.staffReadAt;
    return {
      id: r.id, ref: formatRef(r.number), kind: r.kind, topic: r.topic, subject: r.subject, status: r.status, route: r.route,
      organisationName: r.workspace?.name ?? null, courseName: r.courseId ? names.get(r.courseId) ?? null : null,
      requesterName: r.requesterName, requesterPersona: r.requesterPersona,
      lastActivityAt: r.lastActivityAt, createdAt: r.createdAt, unread: !read || read < r.lastActivityAt,
    };
  });
}

const listSelect = {
  id: true, number: true, kind: true, topic: true, subject: true, status: true, route: true, workspace: { select: { name: true } }, courseId: true,
  requesterName: true, requesterPersona: true, lastActivityAt: true, createdAt: true, requesterReadAt: true, staffReadAt: true,
} as const;

export async function listMyQueries(viewer: Viewer, input: { status?: SupportStatus } = {}) {
  const rows = await prisma.supportQuery.findMany({
    where: { requesterUserId: viewer.user.id, ...(input.status ? { status: input.status } : {}) },
    orderBy: { lastActivityAt: "desc" }, take: 100, select: listSelect,
  });
  return toListItems(rows, "requester");
}

export async function listInbox(viewer: Viewer, input: { route: SupportRoute; status?: SupportStatus; topic?: SupportTopic; cursor?: string; limit?: number }) {
  let base: Prisma.SupportQueryWhereInput;
  if (input.route === "NEXA") {
    if (viewer.persona !== "admin") throw new ViewerError("FORBIDDEN");
    base = { route: "NEXA" };
  } else {
    const access = await staffAccess(viewer);
    if (!access) throw new ViewerError("FORBIDDEN");
    base = access;
  }
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const where: Prisma.SupportQueryWhereInput = { AND: [base, ...(input.status ? [{ status: input.status }] : []), ...(input.topic ? [{ topic: input.topic }] : [])] };
  const [rows, grouped] = await Promise.all([
    prisma.supportQuery.findMany({
      where, orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }], take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), select: listSelect,
    }),
    prisma.supportQuery.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);
  const counts = { OPEN: 0, ANSWERED: 0, CLOSED: 0 } as Record<SupportStatus, number>;
  for (const g of grouped) counts[g.status] = g._count._all;
  const more = rows.length > limit;
  return { items: await toListItems(rows.slice(0, limit), "staff"), nextCursor: more ? rows[limit - 1].id : null, counts };
}

async function loadQuery(id: string, withInternal: boolean) {
  const q = await prisma.supportQuery.findUnique({
    where: { id },
    select: {
      ...listSelect, pagePath: true, helpful: true, requesterEmail: true, userAgent: true, closedAt: true,
      messages: { where: withInternal ? {} : { internal: false }, orderBy: { createdAt: "asc" }, select: { id: true, authorName: true, fromStaff: true, internal: true, body: true, attachments: true, createdAt: true } },
    },
  });
  if (!q) throw new UserError("That query no longer exists.");
  const [item] = await toListItems([q], withInternal ? "staff" : "requester");
  return { ...item, pagePath: q.pagePath, helpful: q.helpful, closedAt: q.closedAt, requesterEmail: withInternal ? q.requesterEmail : null, userAgent: withInternal ? q.userAgent : null, messages: q.messages };
}

/** A query and its thread; staff also get internal notes. Marks it read for whoever is looking. */
export async function getQuery(viewer: Viewer, id: string) {
  const access = await accessTo(viewer, id);
  if (!access) throw new ViewerError("FORBIDDEN");
  const staffSide = access !== "requester";
  const out = await loadQuery(id, staffSide);
  await prisma.supportQuery.update({ where: { id }, data: staffSide ? { staffReadAt: new Date() } : { requesterReadAt: new Date() } });
  return { ...out, viewerIs: access };
}

/** The public requester's view through their private link. */
export async function getQueryByToken(token: string) {
  const q = await prisma.supportQuery.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!q || token.length < 32) throw new UserError("This link doesn't work any more. Send us a new query.");
  const out = await loadQuery(q.id, false);
  await prisma.supportQuery.update({ where: { id: q.id }, data: { requesterReadAt: new Date() } });
  return out;
}

/* ------------------------------------------------------------------------- */
/* Replying and status                                                        */
/* ------------------------------------------------------------------------- */

async function addMessage(queryId: string, author: { userId: string | null; name: string; fromStaff: boolean }, raw: z.input<typeof replySchema>) {
  const input = replySchema.parse(raw);
  const internal = author.fromStaff && !!input.internal;
  const now = new Date();
  const current = await prisma.supportQuery.findUniqueOrThrow({ where: { id: queryId }, select: { status: true, closedAt: true } });
  const next = statusAfterMessage({ current: current.status, fromStaff: author.fromStaff, internal, closedAt: current.closedAt, now });
  if (!next.allowed) throw new UserError("This query closed a while ago. Send a new query instead, and mention this one's reference.");
  const [msg, q] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { queryId, authorUserId: author.userId, authorName: author.name.slice(0, 120), fromStaff: author.fromStaff, internal, body: input.body, attachments: author.userId ? cleanAttachments(input.attachments, author.userId) : [] },
      select: { id: true, authorName: true, fromStaff: true, internal: true, body: true, attachments: true, createdAt: true },
    }),
    prisma.supportQuery.update({
      where: { id: queryId },
      data: internal
        ? { staffReadAt: now }
        : { status: next.status, lastActivityAt: now, closedAt: next.status === "CLOSED" ? current.closedAt : null, ...(author.fromStaff ? { staffReadAt: now } : { requesterReadAt: now }) },
      select: qSelect,
    }),
  ]);
  if (!internal) {
    if (author.fromStaff) await tellRequester(q, "answered", input.body, author.name);
    else await tellAnswerers(q, "reply", input.body);
  }
  return msg;
}

/** Whoever answers signs as themselves, with the organisation or "Nexa support". */
async function staffSignature(viewer: Viewer, access: Access): Promise<string> {
  const first = viewer.user.name.split(" ")[0] || viewer.user.name;
  if (access === "nexa") return `${first}, Nexa support`;
  return viewer.workspace ? `${first}, ${viewer.workspace.name}` : first;
}

export async function replyToQuery(viewer: Viewer, raw: z.input<typeof replySchema>) {
  const access = await accessTo(viewer, raw.id);
  if (!access) throw new ViewerError("FORBIDDEN");
  if (access === "requester") return addMessage(raw.id, { userId: viewer.user.id, name: viewer.user.name, fromStaff: false }, { ...raw, internal: false });
  return addMessage(raw.id, { userId: viewer.user.id, name: await staffSignature(viewer, access), fromStaff: true }, raw);
}

export async function replyByToken(token: string, raw: Omit<z.input<typeof replySchema>, "id" | "internal">) {
  const q = await prisma.supportQuery.findUnique({ where: { accessToken: token }, select: { id: true, requesterName: true } });
  if (!q || token.length < 32) throw new UserError("This link doesn't work any more. Send us a new query.");
  return addMessage(q.id, { userId: null, name: q.requesterName, fromStaff: false }, { ...raw, id: q.id, internal: false, attachments: [] });
}

export async function setQueryStatus(viewer: Viewer, input: { id: string; status: SupportStatus }) {
  const access = await accessTo(viewer, input.id);
  if (!access) throw new ViewerError("FORBIDDEN");
  if (access === "requester" && input.status === "ANSWERED") throw new ViewerError("FORBIDDEN");
  const now = new Date();
  await prisma.supportQuery.update({
    where: { id: input.id },
    data: { status: input.status, closedAt: input.status === "CLOSED" ? now : null, ...(access === "requester" ? { requesterReadAt: now } : { staffReadAt: now }) },
  });
  return { status: input.status };
}

export async function rateAnswer(viewer: Viewer, input: { id: string; helpful: boolean }) {
  const access = await accessTo(viewer, input.id);
  if (access !== "requester") throw new ViewerError("FORBIDDEN");
  await prisma.supportQuery.update({ where: { id: input.id }, data: { helpful: input.helpful } });
  return { ok: true as const };
}

/** Nexa admin: hand a query to an organisation, or take it back. */
export async function moveQuery(viewer: Viewer, input: { id: string; route: SupportRoute; workspaceId?: string }) {
  if (viewer.persona !== "admin") throw new ViewerError("FORBIDDEN");
  const q = await prisma.supportQuery.findUnique({ where: { id: input.id }, select: { workspaceId: true } });
  if (!q) throw new UserError("That query no longer exists.");
  const workspaceId = input.route === "WORKSPACE" ? input.workspaceId ?? q.workspaceId : q.workspaceId;
  if (input.route === "WORKSPACE") {
    if (!workspaceId || !(await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } }))) throw new UserError("Choose the organisation to hand it to.");
  }
  const moved = await prisma.supportQuery.update({ where: { id: input.id }, data: { route: input.route, workspaceId, status: "OPEN", lastActivityAt: new Date() }, select: qSelect });
  await prisma.supportMessage.create({ data: { queryId: input.id, authorUserId: viewer.user.id, authorName: `${viewer.user.name.split(" ")[0]}, Nexa support`, fromStaff: true, internal: true, body: input.route === "WORKSPACE" ? "Handed to the organisation to answer." : "Taken back by Nexa support." } });
  if (input.route === "WORKSPACE") await tellAnswerers(moved, "new", "Handed over by Nexa support.");
  return { route: input.route };
}

/* ------------------------------------------------------------------------- */
/* Housekeeping                                                               */
/* ------------------------------------------------------------------------- */

/** Deletes queries closed longer ago than the keep period. */
export async function pruneOldQueries(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - SUPPORT_LIMITS.keepDays * DAY);
  const { count } = await prisma.supportQuery.deleteMany({ where: { status: "CLOSED", closedAt: { lt: before } } });
  return count;
}

/** Account deletion: the person's own queries go with them. */
export async function deleteQueriesOf(userId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
  const { count } = await db.supportQuery.deleteMany({ where: { requesterUserId: userId } });
  return count;
}
