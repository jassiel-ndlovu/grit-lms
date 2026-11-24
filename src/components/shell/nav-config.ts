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

import { staffScope, type Permission, type Persona, type Viewer } from "@/lib/viewer-core";
import { assignmentRoutes } from "@/features/assignments/routes";

export type NavIcon =
  | "home" | "book" | "calendar" | "test" | "assignment" | "grades"
  | "gradebook" | "analytics" | "users" | "settings" | "help" | "inbox" | "billing" | "fees";

/**
 * Each destination's icon colour: a CSS variable set in globals.css and per
 * theme in themes.css (`--nav-*`, light and dark). Keyed by destination
 * kind, never by position, so Tests is the same teal in every role's
 * sidebar. "profile" is used only by the legacy shell.
 *
 * Icons are filled (22 Nov): `navHue` is the outline, which clears 3:1 on
 * the sidebar (scripts/check-themes.ts), and `navFill` is the fill, the same
 * hue mixed into the sidebar by `--nav-fill-mix` (more on the active row).
 * So the outline is the darker shade in light mode and the lighter one in
 * dark mode, in every theme, with no colour written here.
 */
export type NavHue = NavIcon | "profile";
export const navHue = (key: NavHue) => `var(--nav-${key})`;
export const navFill = (key: NavHue, active = false) =>
  `color-mix(in oklab, var(--nav-${key}) var(${active ? "--nav-fill-mix-active" : "--nav-fill-mix"}), var(--sidebar))`;

export interface NavLink {
  label: string;
  href: string;
  icon: NavIcon;
  /** Extra words the command palette matches on. */
  keywords?: string[];
  /** Shown only when the viewer holds this permission. */
  requires?: Permission;
  /** Shown only to staff whose role covers the whole workspace: no tutors or branch roles (viewer.md Draft 1.17). */
  wholeWorkspace?: boolean;
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
/** Extra lessons with a tutor (viewer.md Draft 1.21). */
const BOOKINGS: NavLink = { label: "Bookings", href: "/dashboard/bookings", icon: "calendar", keywords: ["book", "lesson", "session", "one-to-one", "availability", "hours"] };
/** Paying fees: guardians, and adult students who see their own (fees.pay). */
const PAY_FEES: NavLink = { label: "Fees", href: "/dashboard/fees", icon: "fees", keywords: ["pay", "invoices", "card"], requires: "fees.pay", billing: true };
/** Listed courses a student (or a parent, for a child) asks to join (#206). */
const FIND_COURSES: NavLink = { label: "Find courses", href: "/dashboard/courses/browse", icon: "book", keywords: ["browse", "join", "enrol", "catalogue"] };
/** A student's or parent's referral link (viewer.md Draft 1.16). */
const REFER: NavLink = { label: "Refer a friend", href: "/dashboard/referrals", icon: "users", keywords: ["referral", "invite", "share", "link"] };
const INBOX: NavLink ={ label: "Notifications", href: "/dashboard/notifications", icon: "inbox", keywords: ["inbox", "updates"] };

const BY_PERSONA: Record<Persona, NavSection[]> = {
  learner: [
    { items: [HOME, INBOX] },
    {
      label: "Learning",
      items: [
        { label: "Courses", href: "/dashboard/courses", icon: "book" },
        FIND_COURSES,
        CALENDAR,
        BOOKINGS,
        { label: "Tests", href: "/dashboard/tests", icon: "test", keywords: ["quiz", "assessment"] },
        { label: "Assignments", href: assignmentRoutes.index, icon: "assignment", keywords: ["submissions", "tasks"] },
        { label: "Grades", href: "/dashboard/grades", icon: "grades", keywords: ["marks", "results"], requires: "grades.view" },
      ],
    },
    { label: "Account", items: [PAY_FEES, REFER] },
  ],
  staff: [
    { items: [HOME, INBOX] },
    {
      label: "Teaching",
      items: [
        { label: "Courses", href: "/dashboard/manage-courses", icon: "book", keywords: ["lessons", "authoring"], requires: "courses.edit" },
        CALENDAR,
        { ...BOOKINGS, requires: "content.view" },
        { label: "Tests", href: "/dashboard/tutor-tests", icon: "test", keywords: ["quiz", "grading", "marking"], requires: "courses.edit" },
        { label: "Assignments", href: assignmentRoutes.index, icon: "assignment", keywords: ["submissions", "marking"], requires: "courses.edit" },
        { label: "Gradebook", href: "/dashboard/gradebook", icon: "gradebook", keywords: ["marks", "weights"], requires: "grades.view" },
        { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", keywords: ["performance"], requires: "courses.edit" },
      ],
    },
    {
      label: "People",
      items: [
        { label: "Students", href: "/dashboard/students", icon: "users", keywords: ["learners", "parents", "sign-in code", "accounts"], requires: "learners.invite" },
        // Shown without Pro too; the page says what opens it (viewer.md Draft 1.20).
        { label: "At risk", href: "/dashboard/at-risk", icon: "users", keywords: ["alerts", "falling marks", "missed work", "absent", "support"], requires: "grades.view" },
        { label: "Join requests", href: "/dashboard/join-requests", icon: "inbox", keywords: ["enrol", "approve", "listed", "waiting"], requires: "learners.invite" },
        // listReferrals needs learners.invite for the whole workspace.
        { label: "Referrals", href: "/dashboard/referrals", icon: "users", keywords: ["referred", "families", "word of mouth"], requires: "learners.invite", wholeWorkspace: true },
        { label: "Members", href: "/dashboard/settings/members", icon: "users", keywords: ["tutors", "admins", "staff", "invite", "team"], requires: "members.invite" },
      ],
    },
    {
      label: "Workspace",
      items: [
        // Shown without Plus too; the page says what opens it (billing.md Draft 1.17).
        { label: "Business", href: "/dashboard/business", icon: "analytics", keywords: ["reports", "income", "collected", "overdue", "students", "dashboard"], requires: "reports.view" },
        { label: "Fees", href: "/dashboard/fees", icon: "fees", keywords: ["parents", "invoices", "paid", "cash", "eft"], requires: "fees.manage", billing: true },
        { label: "Billing", href: "/dashboard/settings/billing", icon: "billing", keywords: ["plan", "payment", "invoice", "card"], requires: "billing.view", billing: true },
      ],
    },
  ],
  admin: [
    { items: [HOME, INBOX] },
    {
      label: "Platform",
      items: [
        { label: "Users", href: "/dashboard/manage-users", icon: "users", keywords: ["accounts"], requires: "admin.console" },
        { label: "Billing", href: "/dashboard/admin/billing", icon: "billing", keywords: ["workspaces", "trial", "comp", "discount", "paystack"], requires: "admin.console", billing: true },
      ],
    },
  ],
  // Guardians get their children's pages in Phase 1 (viewer.children).
  // Calendar: each child's sessions, one at a time (#149).
  guardian: [{ items: [HOME, INBOX] }, { label: "Learning", items: [CALENDAR, BOOKINGS, FIND_COURSES] }, { label: "Account", items: [PAY_FEES, REFER] }],
  none: [{ items: [HOME, INBOX] }],
};

/** Shown at the foot of every role's sidebar. */
export const FOOTER_LINKS: NavLink[] = [
  { label: "Settings", href: "/dashboard/settings", icon: "settings", keywords: ["preferences", "profile", "theme"] },
  { label: "Help", href: "/dashboard/help", icon: "help", keywords: ["support"] },
];

/** The parts of the viewer the nav reads; the whole Viewer also fits. */
export type NavViewer = Pick<Viewer, "persona" | "permissions"> & Partial<Pick<Viewer, "membership" | "mode">>;

/**
 * The viewer's sections, with links they lack the permission for removed.
 * Billing links show only when `opts.billing` is true (the layout passes
 * isBillingEnabled()).
 */
export function navSectionsFor(viewer: NavViewer | null, opts: { billing?: boolean } = {}): NavSection[] {
  const persona = viewer?.persona ?? "none";
  const held = new Set(viewer?.permissions ?? []);
  const whole = viewer !== null && staffScope(viewer as Viewer) === "WORKSPACE";
  return (BY_PERSONA[persona] ?? BY_PERSONA.none)
    .map((s) => ({
      ...s,
      items: s.items.filter((l) => (!l.requires || held.has(l.requires)) && (!l.wholeWorkspace || whole) && (!l.billing || opts.billing === true)),
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

/**
 * Pages shown without the sidebar, top bar or search: the student test
 * runner (`/dashboard/tests/<id>`), so a student can't leave a sitting by
 * accident (b/research/05 "Test runner"). Its pre-test and review pages keep
 * the shell. Also workspace setup (`/dashboard/onboarding`, a/ux/01 §4),
 * which draws its own header.
 */
export function isFocusRoute(pathname: string): boolean {
  if (pathname === "/dashboard/onboarding" || pathname.startsWith("/dashboard/onboarding/")) return true;
  const m = /^\/dashboard\/tests\/([^/]+)\/?$/.exec(pathname);
  return m != null && m[1] !== "pre-test" && m[1] !== "review";
}
