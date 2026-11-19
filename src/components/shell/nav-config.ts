/**
 * Sidebar navigation for the revamp shell, by the viewer's persona and
 * permissions (contracts/viewer.md, contracts/navigation.md). Pure data plus
 * the active-item rule, so it can be checked without a browser
 * (scripts/check-shell-nav.ts).
 *
 * Icons are lucide component names resolved in the client shell, which keeps
 * this file free of React and safe to import anywhere.
 *
 * A link with `requires` shows only when the viewer holds that permission.
 * That hides UI; the page and its actions still check on the server.
 */

import type { Permission, Persona, Viewer } from "@/lib/viewer-core";
import { assignmentRoutes } from "@/features/assignments/routes";

export type NavIcon =
  | "home" | "book" | "calendar" | "test" | "assignment" | "grades"
  | "gradebook" | "analytics" | "users" | "settings" | "help" | "inbox" | "billing";

export interface NavLink {
  label: string;
  href: string;
  icon: NavIcon;
  /** Extra words the command palette matches on. */
  keywords?: string[];
  /** Shown only when the viewer holds this permission. */
  requires?: Permission;
  /** Shown only with billing on (BILLING=1). */
  billing?: boolean;
}

export interface NavSection {
  /** Omit for the unlabelled top group. */
  label?: string;
  items: NavLink[];
}

const HOME: NavLink = { label: "Home", href: "/dashboard", icon: "home", keywords: ["dashboard", "overview"] };
const CALENDAR: NavLink = { label: "Calendar", href: "/dashboard/calendar", icon: "calendar", keywords: ["schedule", "events", "timetable"] };
const INBOX: NavLink = { label: "Notifications", href: "/dashboard/notifications", icon: "inbox", keywords: ["inbox", "updates"] };

const BY_PERSONA: Record<Persona, NavSection[]> = {
  learner: [
    { items: [HOME, INBOX] },
    {
      label: "Learning",
      items: [
        { label: "Courses", href: "/dashboard/courses", icon: "book" },
        CALENDAR,
        { label: "Tests", href: "/dashboard/tests", icon: "test", keywords: ["quiz", "assessment"] },
        { label: "Assignments", href: assignmentRoutes.index, icon: "assignment", keywords: ["submissions", "tasks"] },
        { label: "Grades", href: "/dashboard/grades", icon: "grades", keywords: ["marks", "results"], requires: "grades.view" },
      ],
    },
  ],
  staff: [
    { items: [HOME, INBOX] },
    {
      label: "Teaching",
      items: [
        { label: "Courses", href: "/dashboard/manage-courses", icon: "book", keywords: ["lessons", "authoring"], requires: "courses.edit" },
        CALENDAR,
        { label: "Tests", href: "/dashboard/tutor-tests", icon: "test", keywords: ["quiz", "grading", "marking"] },
        { label: "Assignments", href: assignmentRoutes.index, icon: "assignment", keywords: ["submissions", "marking"] },
        { label: "Gradebook", href: "/dashboard/gradebook", icon: "gradebook", keywords: ["marks", "weights"], requires: "grades.view" },
        { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", keywords: ["performance"], requires: "grades.view" },
      ],
    },
    { label: "People", items: [{ label: "Users", href: "/dashboard/manage-users", icon: "users", keywords: ["students", "accounts"], requires: "learners.invite" }] },
    {
      label: "Workspace",
      items: [{ label: "Billing", href: "/dashboard/settings/billing", icon: "billing", keywords: ["plan", "payment", "invoice", "card"], requires: "billing.view", billing: true }],
    },
  ],
  admin: [
    { items: [HOME, INBOX] },
    { label: "Platform", items: [{ label: "Users", href: "/dashboard/manage-users", icon: "users", keywords: ["accounts"], requires: "admin.console" }] },
  ],
  // Guardians get their children's pages in Phase 1 (viewer.children).
  guardian: [{ items: [HOME, INBOX] }],
  none: [{ items: [HOME, INBOX] }],
};

/** Shown at the foot of every role's sidebar. */
export const FOOTER_LINKS: NavLink[] = [
  { label: "Settings", href: "/dashboard/settings", icon: "settings", keywords: ["preferences", "profile", "theme"] },
  { label: "Help", href: "/dashboard/help", icon: "help", keywords: ["support"] },
];

/** The parts of the viewer the nav reads; the whole Viewer also fits. */
export type NavViewer = Pick<Viewer, "persona" | "permissions">;

/**
 * The viewer's sections, with links they lack the permission for removed.
 * Billing links show only when `opts.billing` is true (the layout passes
 * isBillingEnabled()).
 */
export function navSectionsFor(viewer: NavViewer | null, opts: { billing?: boolean } = {}): NavSection[] {
  const persona = viewer?.persona ?? "none";
  const held = new Set(viewer?.permissions ?? []);
  return (BY_PERSONA[persona] ?? BY_PERSONA.none)
    .map((s) => ({
      ...s,
      items: s.items.filter((l) => (!l.requires || held.has(l.requires)) && (!l.billing || opts.billing === true)),
    }))
    .filter((s) => s.items.length > 0);
}

/**
 * The href to mark current: the longest one that equals the path or is a
 * path-segment prefix of it. "/dashboard" only matches itself, so Home is
 * not lit on every page.
 */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const hit =
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href.endsWith("/") ? href : `${href}/`));
    if (hit && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
