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
  CalendarDays,
  ClipboardCheck,
  Clock,
  Inbox,
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
  LESSON_UPDATED: BookOpen,
  LESSON_DELETED: BookOpen,
  EVENT_CREATED: CalendarDays,
  EVENT_UPDATED: CalendarDays,
  EVENT_DELETED: CalendarDays,
  TEST_SUBMITTED: Inbox,
  SUBMISSION_RECEIVED: Inbox,
  STUDY_REMINDER: GraduationCap,
  GRADING_REMINDER: ClipboardCheck,
};

export interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const Icon = ICON_BY_TYPE[type] ?? Bell;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
