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

/** "Sipho asked for Thandi" (a parent) or "Thandi asked". */
export function askedBy(studentName: string, parentName: string | null): string {
  return parentName ? `${parentName} asked for ${studentName}` : `${studentName} asked`;
}
