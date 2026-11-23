/**
 * Pure helpers for course listings and join requests (#206; viewer.md
 * Draft 1.12, "Course listings and join requests"). Kept apart from the
 * components so scripts/check-join-requests.ts can check them.
 */

import type { Tone } from "./billing-ui";

export const joinRoutes = {
  browse: "/dashboard/courses/browse",
  inbox: "/dashboard/join-requests",
  inboxStatus: (s: JoinStatus) => (s === "PENDING" ? "/dashboard/join-requests" : `/dashboard/join-requests?status=${s}`),
};

/** Find courses with its filters; empty ones are left out. */
export function browseUrl(p: { workspace?: string | null; q?: string | null; cursor?: string | null } = {}): string {
  const sp = new URLSearchParams();
  if (p.workspace) sp.set("workspace", p.workspace);
  if (p.q) sp.set("q", p.q);
  if (p.cursor) sp.set("cursor", p.cursor);
  const s = sp.toString();
  return s ? `${joinRoutes.browse}?${s}` : joinRoutes.browse;
}

/** `?next=` on the welcome page: only Find courses, or null. */
export function browseNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  return raw === joinRoutes.browse || raw.startsWith(`${joinRoutes.browse}?`) ? raw : null;
}

export const JOIN_STATUSES = ["PENDING", "APPROVED", "DECLINED", "CANCELLED"] as const;
export type JoinStatus = (typeof JOIN_STATUSES)[number];

export const JOIN_STATUS_CHIP: Record<JoinStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Waiting", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** `?status=` for the staff inbox; anything else is PENDING. */
export function parseJoinStatus(raw: string | undefined | null): JoinStatus {
  return (JOIN_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as JoinStatus) : "PENDING";
}

/** Limits, as A enforces them (JOIN in join-requests.ts). The forms cap input to match. */
export const JOIN_LIMITS = { messageMax: 500, reasonMax: 300, maxPending: 5 } as const;

/** Who the signed-in person may ask for: themself (a student) and each linked child (a parent). */
export interface AskFor {
  userId: string;
  name: string;
  self: boolean;
}

export function askTargets(me: { userId: string; name: string; isStudent: boolean }, children: Array<{ userId: string; name: string }>): AskFor[] {
  return [
    ...(me.isStudent ? [{ userId: me.userId, name: me.name, self: true }] : []),
    ...children.map((c) => ({ userId: c.userId, name: c.name, self: false })),
  ];
}

/**
 * Approving a minor who asked for themself needs the staff member to
 * confirm a parent's consent; a parent's own request already counts.
 */
export function needsConsent(isMinor: boolean, byParent: boolean): boolean {
  return isMinor && !byParent;
}

/** An open request for this course and student, from listMyJoinRequests rows. */
export function openRequestFor<T extends { id: string; status: string; course: { id: string }; student: { id: string } }>(
  rows: readonly T[],
  courseId: string,
  studentUserId: string,
): T | null {
  return rows.find((r) => r.status === "PENDING" && r.course.id === courseId && r.student.id === studentUserId) ?? null;
}

/** "You're on this course", "Thandi is on this course", or null when none of them is. */
export function enrolledLabel(targets: readonly AskFor[], enrolledUserIds: readonly string[]): string | null {
  const on = targets.filter((t) => enrolledUserIds.includes(t.userId));
  if (on.length === 0) return null;
  if (on.some((t) => t.self)) return "You're on this course";
  const names = on.map((t) => t.name.split(" ")[0]);
  if (names.length === 1) return `${names[0]} is on this course`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are on this course`;
}

/* ───── Referrals (Draft 1.16) ───── */

/** The workspaces a person learns in, or their children do: each once. */
export function familyWorkspaces(v: {
  workspaces: ReadonlyArray<{ id: string; name: string; as: "staff" | "learner" }>;
  children: ReadonlyArray<{ workspaces: ReadonlyArray<{ id: string; name: string }> }>;
}): Array<{ id: string; name: string }> {
  const all = [...v.workspaces.filter((w) => w.as === "learner"), ...v.children.flatMap((c) => c.workspaces)];
  return [...new Map(all.map((w) => [w.id, { id: w.id, name: w.name }])).values()];
}

/** `requested` includes those who joined. */
export function referralCounts(requested: number, joined: number): string {
  if (requested === 0) return "Nobody has asked to join through your link yet.";
  return `${requested} asked to join through your link, ${joined} joined.`;
}

export function referralMessage(workspaceName: string): string {
  return `We learn with ${workspaceName}. See their courses and ask to join:`;
}

/** Who wrote the note on a declined request, from the viewer's side. */
export function noteFrom(decidedBy: { id: string; name: string } | null | undefined, meId: string | null | undefined): string {
  if (!decidedBy) return "Note";
  return decidedBy.id === meId ? "Your note" : `Note from ${decidedBy.name}`;
}

/** "Sipho asked for Thandi" (a parent) or "Thandi asked". */
export function askedBy(studentName: string, parentName: string | null): string {
  return parentName ? `${parentName} asked for ${studentName}` : `${studentName} asked`;
}
