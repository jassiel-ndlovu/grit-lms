/**
 * Labels and routes for the enquiry pipeline screens (viewer.md "Enquiry
 * pipeline"). Client-safe.
 */

import type { StatusTone } from "@/components/shell/status-chip";

export type Stage = "NEW" | "CONTACTED" | "TRIAL" | "ENROLLED" | "LOST";
export const STAGE_ORDER: readonly Stage[] = ["NEW", "CONTACTED", "TRIAL", "ENROLLED", "LOST"];

export const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TRIAL: "Trying a class",
  ENROLLED: "Enrolled",
  LOST: "Didn't join",
};

/** One line for each stage, so the pipeline explains itself. */
export const STAGE_HINT: Record<Stage, string> = {
  NEW: "Nobody has replied yet.",
  CONTACTED: "You've been in touch.",
  TRIAL: "They're trying a class before deciding.",
  ENROLLED: "They joined.",
  LOST: "They decided not to join.",
};

export const STAGE_TONE: Record<Stage, StatusTone> = {
  NEW: "warning",
  CONTACTED: "info",
  TRIAL: "info",
  ENROLLED: "success",
  LOST: "neutral",
};

export const SOURCE_LABEL: Record<string, string> = {
  FORM: "Online form",
  MANUAL: "Added by staff",
  PHONE: "Phone call",
  WALK_IN: "Walk-in",
  SOCIAL: "Social media",
  REFERRAL: "Referral",
  IMPORT: "Import",
  OTHER: "Other",
};

/** Sources staff can choose when adding one by hand. */
export const MANUAL_SOURCES = ["PHONE", "WALK_IN", "SOCIAL", "REFERRAL", "MANUAL", "OTHER"] as const;

export const crmRoutes = {
  list: "/dashboard/enquiries",
  create: "/dashboard/enquiries/new",
  one: (id: string) => `/dashboard/enquiries/${id}`,
  publicForm: (slug: string) => `/enquire/${slug}`,
} as const;

export function gradeLabel(g: number | null | undefined): string | null {
  if (g == null) return null;
  return g === 0 ? "Grade R" : `Grade ${g}`;
}
