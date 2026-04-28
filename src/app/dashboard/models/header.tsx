/**
 * Dashboard header — Inkwell identity (Chapter 5).
 *
 * Layout:
 *   - Left: page title (Fraunces display) + warm muted greeting / role chip.
 *   - Center: search input (token-driven, focus ring branded terracotta).
 *   - Right: help link, NotificationBell (students only), profile dropdown.
 */

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";

import { useProfile } from "@/context/ProfileContext";
import Skeleton from "../components/skeleton";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHeader() {
  const { profile, session } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const showNotificationBell = session?.user?.role === "STUDENT";
  const firstName = profile?.fullName?.split(" ")[0];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

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
                {getGreeting()}
                {firstName ? `, ${firstName}` : ""}.
              </p>
            ) : (
              <Skeleton className="mt-1 h-4 w-40" />
            )}
          </div>
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses, lessons, submissions…"
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/80 transition-shadow focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
    return <Skeleton className="h-10 w-32 rounded-md" />;
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
