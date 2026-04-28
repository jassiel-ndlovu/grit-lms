/**
 * NotificationIcon — small lucide icon picker keyed by NotificationType.
 *
 * Pure render, no client behavior — safe to use from RSC. The legacy
 * header inlined this same map; centralising it keeps the bell and the
 * full page in visual sync as we add new notification kinds.
 */

import {
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { NotificationType } from "@/features/shared/enums";
import { cn } from "@/lib/utils";

const ICON_BY_TYPE: Record<NotificationType, LucideIcon> = {
  COURSE_UPDATE: BookOpen,
  LESSON_CREATED: BookOpen,
  TEST_CREATED: FileText,
  TEST_DELETED: FileText,
  TEST_UPDATED: FileText,
  QUIZ_CREATED: FileText,
  SUBMISSION_CREATED: Bookmark,
  SUBMISSION_DUE: Clock,
  SUBMISSION_UPDATED: Bookmark,
  SUBMISSION_DELETED: Bookmark,
  SUBMISSION_GRADED: Award,
  TEST_DUE: Clock,
  TEST_GRADED: GraduationCap,
  MESSAGE: MessageSquare,
  SYSTEM: Settings,
};

export interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const Icon = ICON_BY_TYPE[type] ?? Bell;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
