/**
 * Where AI help for tutors shows (contracts/viewer.md, "AI help for tutors").
 * Cheap enough for a page load: it reads the course's plan, not the month's
 * runs. The dialogs read what's left when they open. A's actions check
 * everything again on every run.
 */

import "server-only";

import { aiAssistConfigured } from "@/features/ai-assist/model";
import { isBillingEnabled } from "@/features/billing/errors";
import { derivedTier } from "@/features/billing/pricing";
import { hasService } from "@/features/billing/services";
import { prisma } from "@/lib/db";
import { canIn, type Viewer } from "@/lib/viewer";

import type { AiHelp, AiHelpWithLessons } from "./lib/ai-help";

/** The course's AI help for this person, or null when there's none to show. */
export async function aiHelpFor(viewer: Viewer | null, courseId: string): Promise<AiHelp | null> {
  if (!viewer || (viewer.persona !== "staff" && viewer.persona !== "admin") || !aiAssistConfigured()) return null;
  const [may, on] = await Promise.all([canIn(viewer, "courses.edit", { courseId }), hasService(viewer, courseId, "ai-assist")]);
  if (!may || !on) return null;
  const rows = await prisma.courseService.findMany({ where: { courseId, enabled: true }, select: { serviceKey: true } });
  return { courseId, pro: derivedTier(rows.map((r) => r.serviceKey)) === "PRO", credits: isBillingEnabled() };
}

/** The same for several courses, with each one's lessons to draft questions from. */
export async function aiHelpForTests(viewer: Viewer | null, courseIds: string[]): Promise<Map<string, AiHelpWithLessons>> {
  const on = (await Promise.all(courseIds.map((id) => aiHelpFor(viewer, id)))).filter((h): h is AiHelp => h !== null);
  if (on.length === 0) return new Map();
  const lessons = await prisma.lesson.findMany({
    where: { courseId: { in: on.map((h) => h.courseId) }, type: "CONTENT", description: { not: null } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, courseId: true },
  });
  return new Map(
    on.map((h) => [h.courseId, { ...h, lessons: lessons.filter((l) => l.courseId === h.courseId).map(({ id, title }) => ({ id, title })) }]),
  );
}
