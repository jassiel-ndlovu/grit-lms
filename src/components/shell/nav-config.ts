/**
 * Sidebar navigation for the revamp shell, by role. Pure data plus the
 * active-item rule, so it can be checked without a browser
 * (scripts/check-shell-nav.ts).
 *
 * Icons are lucide component names resolved in the client shell, which keeps
 * this file free of React and safe to import anywhere.
 *
 * Roles are today's `session.user.role`. When `getViewer()` lands
 * (contracts/viewer.md) the sections will be chosen by persona and
 * permissions instead; the shape below stays. See contracts/navigation.md.
 */

export type NavIcon =
  | "home" | "book" | "calendar" | "test" | "assignment" | "grades"
  | "gradebook" | "analytics" | "users" | "settings" | "help" | "inbox";

export interface NavLink {
  label: string;
  href: string;
  icon: NavIcon;
  /** Extra words the command palette matches on. */
  keywords?: string[];
}

export interface NavSection {
  /** Omit for the unlabelled top group. */
  label?: string;
  items: NavLink[];
}

const HOME: NavLink = { label: "Home", href: "/dashboard", icon: "home", keywords: ["dashboard", "overview"] };
const CALENDAR: NavLink = { label: "Calendar", href: "/dashboard/calendar", icon: "calendar", keywords: ["schedule", "events", "timetable"] };
const INBOX: NavLink = { label: "Notifications", href: "/dashboard/notifications", icon: "inbox", keywords: ["inbox", "updates"] };

const BY_ROLE: Record<string, NavSection[]> = {
  STUDENT: [
    { items: [HOME, INBOX] },
    {
      label: "Learning",
      items: [
        { label: "Courses", href: "/dashboard/courses", icon: "book" },
        CALENDAR,
        { label: "Tests", href: "/dashboard/tests", icon: "test", keywords: ["quiz", "assessment"] },
        { label: "Assignments", href: "/dashboard/submissions", icon: "assignment", keywords: ["submissions", "tasks"] },
        { label: "Grades", href: "/dashboard/grades", icon: "grades", keywords: ["marks", "results"] },
      ],
    },
  ],
  TUTOR: [
    { items: [HOME, INBOX] },
    {
      label: "Teaching",
      items: [
        { label: "Courses", href: "/dashboard/manage-courses", icon: "book", keywords: ["lessons", "authoring"] },
        CALENDAR,
        { label: "Tests", href: "/dashboard/tutor-tests", icon: "test", keywords: ["quiz", "grading", "marking"] },
        { label: "Assignments", href: "/dashboard/submissions", icon: "assignment", keywords: ["submissions", "marking"] },
        { label: "Gradebook", href: "/dashboard/gradebook", icon: "gradebook", keywords: ["marks", "weights"] },
        { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", keywords: ["performance"] },
      ],
    },
    { label: "People", items: [{ label: "Users", href: "/dashboard/manage-users", icon: "users", keywords: ["students", "accounts"] }] },
  ],
  ADMIN: [
    { items: [HOME, INBOX] },
    { label: "Platform", items: [{ label: "Users", href: "/dashboard/manage-users", icon: "users", keywords: ["accounts"] }] },
  ],
  PARENT: [{ items: [HOME, INBOX] }],
};

/** Shown at the foot of every role's sidebar. */
export const FOOTER_LINKS: NavLink[] = [
  { label: "Settings", href: "/dashboard/settings", icon: "settings", keywords: ["preferences", "profile", "theme"] },
  { label: "Help", href: "/dashboard/help", icon: "help", keywords: ["support"] },
];

export function navSectionsForRole(role: string | undefined): NavSection[] {
  return BY_ROLE[role ?? "STUDENT"] ?? BY_ROLE.STUDENT;
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
