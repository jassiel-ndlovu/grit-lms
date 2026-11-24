/**
 * The study assistant and study credits screens' pure helpers (viewer.md
 * "Study assistant", billing.md "AI credit top-ups"). Client-safe; checked
 * by scripts/check-study-ui.ts.
 */

import type { StatusTone } from "@/components/shell/status-chip";
import { roughAnswers } from "@/features/ai-credits/topup-math";

export const studyRoutes = {
  /** A student's assistant on a course; `chat` opens one of their chats. */
  assistant: (courseId: string, chatId?: string | null) =>
    `/dashboard/courses/${courseId}/assistant${chatId ? `?chat=${encodeURIComponent(chatId)}` : ""}`,
  /** The tutor's side. */
  chats: (courseId: string, chatId?: string) =>
    `/dashboard/manage-courses/${courseId}/study-chats${chatId ? `/${chatId}` : ""}`,
  /** The tutor's on and off switch for each student. */
  students: (courseId: string) => `/dashboard/manage-courses/${courseId}/study-chats/students`,
  /** A parent reads their child's chats. */
  childChats: (childUserId: string, chatId?: string) =>
    `/dashboard/children/${encodeURIComponent(childUserId)}/study-chats${chatId ? `/${encodeURIComponent(chatId)}` : ""}`,
  credits: "/dashboard/credits",
  childCredits: (childUserId: string) => `/dashboard/credits?child=${encodeURIComponent(childUserId)}`,
  creditsReturn: "/dashboard/credits/return",
  workspaceCredits: "/dashboard/settings/billing/credits",
};

const REASONS = ["NOT_ON_PLAN", "OFF_FOR_STUDENT", "COMING_SOON", "NO_CREDITS"] as const;
export type StudyReason = (typeof REASONS)[number] | null;

/** A status's reason; one this build doesn't know closes the box rather than opening it. */
export const reasonOf = (reason: string | null): StudyReason =>
  reason === null ? null : (REASONS.find((r) => r === reason) ?? "NOT_ON_PLAN");

export interface StudyCitation {
  lessonId: string;
  title: string;
}

export interface StudyMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: StudyCitation[];
  /** Staff only. */
  concern: string | null;
}

/** Citations are stored as JSON: keep only the ones that name a lesson, once each. */
export function citationsOf(value: unknown): StudyCitation[] {
  if (!Array.isArray(value)) return [];
  const out: StudyCitation[] = [];
  for (const c of value as Array<{ lessonId?: unknown; title?: unknown } | null>) {
    if (typeof c?.lessonId !== "string" || typeof c.title !== "string" || !c.lessonId || !c.title) continue;
    if (!out.some((o) => o.lessonId === c.lessonId)) out.push({ lessonId: c.lessonId, title: c.title });
  }
  return out;
}

export function messageView(m: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  concern?: string | null;
}): StudyMessageView {
  return {
    id: m.id,
    role: m.role === "USER" ? "USER" : "ASSISTANT",
    content: m.content,
    citations: citationsOf(m.citations),
    concern: m.concern ?? null,
  };
}

const CONCERNS: Record<string, { label: string; tone: StatusTone }> = {
  wellbeing: { label: "Wellbeing", tone: "danger" },
  safety: { label: "Safety", tone: "danger" },
  integrity: { label: "Asked about graded work", tone: "warning" },
};

/** What a tutor sees beside a message; null when there's nothing to note. */
export const concernChip = (concern: string | null | undefined) => (concern ? (CONCERNS[concern] ?? null) : null);

/** "13 392", with spaces that don't break. */
export const number = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g, " ");
const count = (n: number, one: string) => `${number(n)} ${n === 1 ? one : `${one}s`}`;

/** "About 334 answers". Rounds down. */
export function answersLabel(credits: number): string {
  const n = roughAnswers(Math.max(0, credits));
  return n === 0 ? "No answers" : `About ${count(n, "answer")}`;
}

/** The line under the question box. */
export function leftLabel(leftToday: number, perDay: number, credits: number): string {
  return `${leftToday} of ${perDay} questions left today. Your credits cover ${answersLabel(credits).toLowerCase()}.`;
}

/** How long a pack lasts, shown before paying. */
export const validityLabel = (days: number) => (days % 365 === 0 ? count(days / 365, "year") : count(days, "day"));

/** The next bought pack to expire, or null. */
export function nextExpiry(purchases: Array<{ expiresAt: Date | null; expired: boolean }>): Date | null {
  const open = purchases.filter((p) => !p.expired && p.expiresAt).map((p) => p.expiresAt!.getTime());
  return open.length ? new Date(Math.min(...open)) : null;
}

/** "Off for 2 of 24 students." */
export function switchSummary(off: number, total: number): string {
  if (off === 0) return "On for every student.";
  return off === total ? "Off for every student." : `Off for ${number(off)} of ${count(total, "student")}.`;
}

/** "Maths", "Maths and Science", "Maths, Science and English". */
export const nameList = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Whether a name has every word typed. */
export function matchName(name: string, query: string): boolean {
  const n = name.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((w) => n.includes(w));
}

/** Why the question box is closed, or null when it's open. */
export function closedNote(input: {
  reason: StudyReason;
  leftToday: number;
  perDay: number;
}): { title: string; text: string } | null {
  switch (input.reason) {
    case "NOT_ON_PLAN":
      return { title: "The study assistant is off for this course", text: "You can still read your earlier chats." };
    case "OFF_FOR_STUDENT":
      return { title: "The study assistant is off for you on this course", text: "Your tutor switched it off. You can still read your earlier chats." };
    case "COMING_SOON":
      return { title: "The study assistant opens in January", text: "You'll be able to ask about this course's lessons." };
    case "NO_CREDITS":
      return { title: "You need study credits to ask", text: "Each answer uses some of them." };
  }
  if (input.leftToday <= 0) {
    return { title: `You've asked ${input.perDay} questions in a day`, text: "Ask again tomorrow, or ask your tutor." };
  }
  return null;
}
