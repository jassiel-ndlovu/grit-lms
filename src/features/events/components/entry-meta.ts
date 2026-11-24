/** Icon and label for a calendar entry (#149). */

import { CalendarCheck, CalendarDays, GraduationCap, Megaphone, Pencil, Presentation, Users, Video } from "lucide-react";

import type { CalendarEntry } from "../lib/calendar-ui";

export function iconFor(e: Pick<CalendarEntry, "kind" | "type">) {
  if (e.kind === "booking") return CalendarCheck;
  if (e.kind !== "event") return Pencil;
  switch (e.type) {
    case "LECTURE":
      return Presentation;
    case "EXAM":
      return GraduationCap;
    case "REMINDER":
      return Megaphone;
    case "LIVE":
      return Video;
    case "MEETING":
      return Users;
    default:
      return CalendarDays;
  }
}

export function labelFor(e: Pick<CalendarEntry, "kind" | "type">): string {
  if (e.kind === "booking") return "Booked lesson";
  if (e.kind === "test") return "Test due";
  if (e.kind === "assignment") return "Assignment due";
  switch (e.type) {
    case "LECTURE":
      return "Lesson";
    case "EXAM":
      return "Exam";
    case "REMINDER":
      return "Reminder";
    case "LIVE":
      return "Live session";
    case "MEETING":
      return "Meeting";
    case "TEST":
      return "Test";
    case "SUBMISSION":
      return "Assignment";
    case "HOLIDAY":
      return "Holiday";
    default:
      return "Event";
  }
}
