/**
 * Dashboard header — Inkwell identity (Chapter 5).
 *
 * Layout:
 *   - Left: page title (Fraunces display) + warm muted greeting / role chip.
 *   - Center: global search (inline on md+, an icon + full-screen sheet below).
 *   - Small screens: hamburger opens the nav drawer; title shrinks to one line.
 *   - Right: help link, NotificationBell, profile dropdown.
 */

"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Settings,
  User,
} from "lucide-react";

import { useProfile } from "@/context/ProfileContext";
import Skeleton from "../components/skeleton";
import { GlobalSearch } from "@/features/search/components/global-search";
import { navPagesForRole } from "./nav";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useDateContext } from "@/components/preferences-provider";
import { greetingFor } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  courses: "My Courses",
  calendar: "Schedule",
  submissions: "Submissions",
  tests: "Tests & Quizzes",
  grades: "Grades",
  groups: "Study Groups",
  notifications: "Notifications",
  profile: "Profile",
  settings: "Settings",
  help: "Help & Support",
  "manage-courses": "Manage Courses",
  "tutor-tests": "Tests & Grading",
  "browse-courses": "Browse Courses",
  account: "Account",
};

function getPageTitle(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "Dashboard";
  const key = segments[1];
  return PAGE_TITLES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

interface DashboardHeaderProps {
  /** Opens the nav drawer (small screens only — the button hides at lg). */
  onOpenMenu: () => void;
}

export default function DashboardHeader({ onOpenMenu }: DashboardHeaderProps) {
  const { profile, session } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const dateCtx = useDateContext();
  const showNotificationBell = Boolean(session?.user);
  const firstName = profile?.fullName?.split(" ")[0];
  const searchPages = useMemo(
    () => navPagesForRole(session?.user.role),
    [session?.user.role],
  );

  return (
    // Fixed height (h-14 / lg:h-20) so sticky bars further down the page
    // can sit flush beneath it with `top-14 lg:top-20`.
    <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-card/85 backdrop-blur-md lg:h-20">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Compact title on small screens. */}
          <h1 className="truncate font-display text-lg leading-tight tracking-tight text-foreground lg:hidden">
            {getPageTitle(pathname)}
          </h1>

          <div className="hidden min-w-0 lg:block">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground">
                {getPageTitle(pathname)}
              </h1>
              {session?.user.role && (
                <Badge variant="soft" className="rounded-full px-2.5 py-0.5">
                  {session.user.role.toLowerCase()}
                </Badge>
              )}
            </div>
            {profile ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {greetingFor(new Date(), dateCtx.timeZone)}
                {firstName ? `, ${firstName}` : ""}.
              </p>
            ) : (
              <Skeleton className="mt-1 h-4 w-40" />
            )}
          </div>
        </div>

        <div className="flex flex-1 justify-end md:justify-center">
          <GlobalSearch pages={searchPages} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/help")}
            className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            aria-label="Help and support"
            title="Help and support"
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          {showNotificationBell && <NotificationBell />}

          <ProfileMenu profile={profile} email={session?.user?.email ?? null} />
        </div>
      </div>
    </header>
  );
}

interface ProfileMenuProps {
  profile: AppTypes.Student | AppTypes.Tutor | null;
  email: string | null;
}

function ProfileMenu({ profile, email }: ProfileMenuProps) {
  const router = useRouter();

  if (!profile) {
    return <Skeleton className="h-10 w-12 rounded-md sm:w-32" />;
  }

  const initial = profile.fullName?.charAt(0).toUpperCase() ?? "U";
  const firstName = profile.fullName?.split(" ")[0];
  const avatarUrl =
    "imageUrl" in profile ? profile.imageUrl : profile.profileImageUrl;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <div className="relative">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
                {initial}
              </div>
            )}
          </div>
          <span className="hidden max-w-[8rem] truncate font-medium sm:inline-block">
            {firstName}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="px-2 py-2">
          <p className="truncate text-sm font-medium text-foreground">
            {profile.fullName}
          </p>
          {email && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push("/dashboard/account")}>
          <User className="h-4 w-4" />
          <span>View profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => signOut()}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
