/**
 * Dashboard sidebar — Inkwell identity (Chapter 5).
 *
 * Approach:
 *   - Single visual treatment for every nav item: muted by default, slate
 *     foreground on hover, slate-tinted background + terracotta indicator
 *     when active. Drops the previous per-icon rainbow palette in favour
 *     of one calm, consistent rhythm.
 *   - Wordmark is set in Fraunces — the lone display-serif moment in the
 *     sidebar to anchor the brand.
 *   - Drops the legacy NotificationsContext dependency. The notification
 *     unread count is now surfaced exclusively by the header bell so the
 *     two surfaces can't drift; the sidebar entry is just a navigation
 *     link.
 *   - Drops the gradient/glow effects, the speculative "Today / Progress"
 *     stats card, and the redundant in-sidebar search. Header owns search.
 *
 * Behaviour preserved:
 *   - Active-item detection by longest path prefix (handles nested routes).
 *   - Collapse / expand toggle, bottom utility items, and the sign-out tile.
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  LogOut,
  PenTool,
  Settings,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useProfile } from "@/context/ProfileContext";
import Skeleton from "../components/skeleton";
import { APP_SHORT_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  link: string;
  description?: string;
}

const STUDENT_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { icon: Home, label: "Dashboard", link: "/dashboard", description: "Overview" },
  { icon: BookOpen, label: "My Courses", link: "/dashboard/courses", description: "Enrolled courses" },
  { icon: Calendar, label: "Schedule", link: "/dashboard/calendar", description: "Events" },
  { icon: PenTool, label: "Submissions", link: "/dashboard/submissions", description: "Tasks" },
  { icon: FileText, label: "Tests", link: "/dashboard/tests", description: "Assessments" },
  { icon: Award, label: "Grades", link: "/dashboard/grades", description: "Performance" },
  { icon: Users, label: "Study Groups", link: "/dashboard/groups", description: "Collaborate" },
  { icon: Bell, label: "Notifications", link: "/dashboard/notifications", description: "Updates" },
];

const TUTOR_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { icon: Home, label: "Dashboard", link: "/dashboard", description: "Analytics" },
  { icon: Wrench, label: "Manage Courses", link: "/dashboard/manage-courses", description: "Authoring" },
  { icon: Calendar, label: "Schedule", link: "/dashboard/calendar", description: "Events" },
  { icon: FileText, label: "Tests", link: "/dashboard/tutor-tests", description: "Grading" },
  { icon: PenTool, label: "Submissions", link: "/dashboard/submissions", description: "Review" },
  { icon: Bell, label: "Notifications", link: "/dashboard/notifications", description: "Updates" },
];

const BOTTOM_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { icon: User, label: "Profile", link: "/dashboard/account" },
  { icon: Settings, label: "Settings", link: "/dashboard/settings" },
  { icon: HelpCircle, label: "Help", link: "/dashboard/help" },
];

/**
 * Resolve the active nav item from the current pathname using a
 * longest-prefix match across both lists. Lifted out as a pure helper so
 * it's easy to test in isolation if we ever want to.
 */
function findActiveLabel(
  pathname: string,
  candidates: ReadonlyArray<NavItem>,
): string | null {
  const clean = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;

  let best: NavItem | null = null;
  for (const item of candidates) {
    if (!item.link || item.link === "#") continue;
    const itemLink = item.link.endsWith("/") && item.link !== "/"
      ? item.link.slice(0, -1)
      : item.link;
    if (clean === itemLink || clean.startsWith(itemLink + "/")) {
      if (!best || itemLink.length > best.link.length) {
        best = item;
      }
    }
  }
  return best?.label ?? null;
}

export default function Nav() {
  const { session, profile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = useMemo(
    () => (session?.user.role === "TUTOR" ? TUTOR_NAV_ITEMS : STUDENT_NAV_ITEMS),
    [session?.user.role],
  );

  const allItems = useMemo(
    () => [...navItems, ...BOTTOM_NAV_ITEMS],
    [navItems],
  );

  const [activeLabel, setActiveLabel] = useState<string>("Dashboard");

  const recomputeActive = useCallback(() => {
    setActiveLabel(findActiveLabel(pathname, allItems) ?? "Dashboard");
  }, [pathname, allItems]);

  useEffect(() => {
    recomputeActive();
  }, [recomputeActive]);

  return (
    <nav
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col overflow-y-auto",
        "border-r border-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-out",
        isCollapsed ? "w-20" : "w-72",
      )}
    >
      {/* Wordmark + collapse */}
      <div className="flex items-center justify-between border-b border-border px-4 py-5">
        {!isCollapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl leading-none tracking-tight text-foreground">
                {APP_SHORT_NAME}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {session?.user.role
                  ? `${session.user.role.toLowerCase()} portal`
                  : "Loading"}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed((c) => !c)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Primary nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              active={activeLabel === item.label}
              collapsed={isCollapsed}
              onClick={() => {
                setActiveLabel(item.label);
                router.push(item.link);
              }}
            />
          ))}
        </ul>
      </div>

      {/* Utility nav + sign out */}
      <div className="mt-auto border-t border-border px-3 py-3">
        <ul className="flex flex-col gap-1">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              active={activeLabel === item.label}
              collapsed={isCollapsed}
              onClick={() => {
                setActiveLabel(item.label);
                router.push(item.link);
              }}
            />
          ))}
        </ul>

        <div className="mt-3 border-t border-border pt-3">
          {profile ? (
            <button
              type="button"
              onClick={() => signOut()}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
                "hover:bg-muted",
                isCollapsed && "justify-center",
              )}
              aria-label="Sign out"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                {profile.fullName?.charAt(0).toUpperCase() ?? "U"}
              </div>
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {profile.fullName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                  <LogOut className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-destructive" />
                </>
              )}
            </button>
          ) : (
            <div
              className={cn(
                "flex items-center gap-3 p-2",
                isCollapsed && "justify-center",
              )}
            >
              <Skeleton className="h-9 w-9 rounded-md" />
              {!isCollapsed && (
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------------- */
/* NavRow                                                                     */
/* ------------------------------------------------------------------------- */

interface NavRowProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavRow({ item, active, collapsed, onClick }: NavRowProps) {
  const { icon: Icon, label, description } = item;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          collapsed && "justify-center px-2",
        )}
        title={collapsed ? label : undefined}
      >
        {/* Active indicator — terracotta tab on the left edge. */}
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-terracotta"
          />
        )}

        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-brand-terracotta" : "text-muted-foreground",
          )}
        />

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{label}</p>
            {description && (
              <p className="truncate text-xs text-muted-foreground/80">
                {description}
              </p>
            )}
          </div>
        )}
      </button>
    </li>
  );
}
