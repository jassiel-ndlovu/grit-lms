"use client";

/**
 * AppShell — the revamp frame (REVAMP_UI): a Notion-style sidebar beside
 * the page. The sidebar holds everything global (account, search, inbox,
 * the role's pages, settings, help), so each page's own header only carries
 * the page's breadcrumb, status and actions (page-header.tsx).
 *
 * lg and up: the sidebar is sticky beside the content. Below lg: a slim top
 * bar with a menu button opens the same sidebar as a drawer, and keeps
 * search one tap away. The window stays the only vertical scroller.
 *
 * Ctrl/⌘K opens the command palette: pages from the nav, plus live search
 * through the `searchEverything` server action when `search` is on.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Award, BarChart3, BookOpen, Calendar, ChevronsUpDown, ClipboardList, FileText,
  CreditCard, GraduationCap, HelpCircle, Home, Inbox, LogOut, Menu, Search, Settings, User,
  Users, X, type LucideIcon,
} from "lucide-react";

import { CommandPalette, useCommandPaletteShortcut, type CommandGroup } from "@/components/ui/command-palette";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Sidebar, SidebarItem, SidebarSection } from "@/components/ui/sidebar";
import { searchEverything } from "@/features/search/actions";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { switchWorkspace } from "@/features/workspaces/actions";
import { APP_SHORT_NAME } from "@/lib/branding";
import { toast } from "sonner";

import { FOOTER_LINKS, activeHref, type NavIcon, type NavSection } from "./nav-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home, book: BookOpen, calendar: Calendar, test: FileText, assignment: ClipboardList,
  grades: Award, gradebook: GraduationCap, analytics: BarChart3, users: Users,
  settings: Settings, help: HelpCircle, inbox: Inbox, billing: CreditCard,
};

/** What the shells show of the viewer. Built once in the dashboard layout. */
export interface ShellUser {
  name: string;
  email: string;
  /** Legacy role (STUDENT, TUTOR, ADMIN, PARENT) until nav goes by persona. */
  role: string;
  imageUrl?: string | null;
  /** Workspaces the user can switch to (viewer.workspaces). */
  workspaces?: ShellWorkspace[];
  /** The active one (viewer.workspace.id); null for guardians and admins. */
  workspaceId?: string | null;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  /** How the user belongs to it, shown beside the name. */
  as: "staff" | "learner";
}

interface AppShellProps {
  user: ShellUser;
  sections: NavSection[];
  children: React.ReactNode;
  /** Live search in the palette (needs a signed-in session). Default true. */
  search?: boolean;
  /** The notification bell (needs a signed-in session). Default true. */
  notifications?: boolean;
  /**
   * Account-wide notice above every page (verify email, suspended,
   * read-only). Agent A's slot; full width of the content column.
   */
  banner?: React.ReactNode;
}

const SEARCH_DEBOUNCE_MS = 250;

function usePaletteSearch(enabled: boolean) {
  const [groups, setGroups] = React.useState<CommandGroup[]>([]);
  const [busy, setBusy] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = React.useRef(0);

  const onQueryChange = React.useCallback(
    (q: string) => {
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      const query = q.trim();
      if (query.length < 2) {
        setGroups([]);
        setBusy(false);
        return;
      }
      setBusy(true);
      timer.current = setTimeout(async () => {
        const mine = ++seq.current;
        const res = await searchEverything({ query });
        if (mine !== seq.current) return; // a newer query won
        setBusy(false);
        setGroups(
          (res?.data?.groups ?? []).map((g) => ({
            label: g.label,
            remote: true,
            items: g.hits.map((h) => ({ id: `${g.key}:${h.id}`, label: h.title, hint: h.subtitle, href: h.href })),
          })),
        );
      }, SEARCH_DEBOUNCE_MS);
    },
    [enabled],
  );
  return { groups, busy, onQueryChange };
}

/** Switches through A's switchWorkspace action, then re-renders with the new context. */
function useWorkspaceSwitch() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const switchTo = (workspaceId: string) =>
    start(async () => {
      const res = await switchWorkspace({ workspaceId });
      if (res?.data) router.refresh();
      else toast.error("Could not switch workspace. Try again.");
    });
  return { pending, switchTo };
}

function AccountMenu({ user }: { user: ShellUser }) {
  const workspaces = user.workspaces ?? [];
  const current = workspaces.find((w) => w.id === user.workspaceId);
  const { pending, switchTo } = useWorkspaceSwitch();
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-2">
        {user.imageUrl ? (
          <Image src={user.imageUrl} alt="" width={24} height={24} className="size-6 shrink-0 rounded object-cover" />
        ) : (
          <span aria-hidden className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded text-[0.6875rem] font-semibold">
            {initials || "?"}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{user.name}</span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          {current && workspaces.length === 1 ? (
            <p className="text-muted-foreground mt-1 truncate text-xs">{current.name}</p>
          ) : null}
        </DropdownMenuLabel>
        {workspaces.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Workspace</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={user.workspaceId ?? ""}
              onValueChange={(id) => id !== user.workspaceId && switchTo(id)}
            >
              {workspaces.map((w) => (
                <DropdownMenuRadioItem key={w.id} value={w.id} disabled={pending}>
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  <span className="text-muted-foreground text-xs">{w.as === "staff" ? "Teaching" : "Learning"}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile"><User /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings"><Settings /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/" })}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShellSidebar({
  user, sections, notifications, onSearch, onNavigate, className,
}: {
  user: ShellUser;
  sections: NavSection[];
  notifications: boolean;
  onSearch: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const all = [...sections.flatMap((s) => s.items), ...FOOTER_LINKS];
  const current = activeHref(pathname, all.map((l) => l.href));
  const item = (l: (typeof all)[number]) => {
    const Icon = ICONS[l.icon];
    return (
      <SidebarItem key={l.href} href={l.href} icon={<Icon />} active={l.href === current} onClick={onNavigate}>
        {l.label}
      </SidebarItem>
    );
  };

  return (
    <Sidebar aria-label="Main" className={className}>
      <div className="flex items-center gap-1">
        <AccountMenu user={user} />
        {notifications ? <NotificationBell /> : null}
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring -mt-2 flex h-8 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      {sections.map((s, i) => (
        <SidebarSection key={s.label ?? i} label={s.label}>
          {s.items.map(item)}
        </SidebarSection>
      ))}
      <SidebarSection className="mt-auto">{FOOTER_LINKS.map(item)}</SidebarSection>
    </Sidebar>
  );
}

export function AppShell({ user, sections, children, search = true, notifications = true, banner }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const menuButton = React.useRef<HTMLButtonElement>(null);
  const closingToSearch = React.useRef(false);
  useCommandPaletteShortcut(setPaletteOpen);
  const remote = usePaletteSearch(search);

  const pageGroup: CommandGroup = {
    label: "Go to",
    items: [...sections.flatMap((s) => s.items), ...FOOTER_LINKS].map((l) => {
      const Icon = ICONS[l.icon];
      return { id: l.href, label: l.label, href: l.href, keywords: l.keywords, icon: <Icon /> };
    }),
  };
  const openSearch = () => {
    closingToSearch.current = drawerOpen;
    setDrawerOpen(false);
    setPaletteOpen(true);
  };

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <ShellSidebar
        user={user}
        sections={sections}
        notifications={notifications}
        onSearch={openSearch}
        className="sticky top-0 hidden h-screen shrink-0 lg:flex"
      />

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // No Radix Trigger (the menu button lives in the top bar), so hand focus back
            // by hand, unless the drawer closed to open search: the palette has focus then.
            onCloseAutoFocus={(e) => {
              if (closingToSearch.current) {
                closingToSearch.current = false;
                e.preventDefault();
                return;
              }
              if (!menuButton.current?.offsetParent) return;
              e.preventDefault();
              menuButton.current.focus();
            }}
            className="fixed inset-y-0 left-0 z-50 flex lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <ShellSidebar
              user={user}
              sections={sections}
              notifications={notifications}
              onSearch={openSearch}
              onNavigate={() => setDrawerOpen(false)}
              className="h-full shadow-xl"
            />
            <DialogPrimitive.Close className="bg-background absolute top-3 -right-11 grid size-9 place-items-center rounded-md border" aria-label="Close navigation">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* min-w-0: wide tables and code scroll inside the page, not the window. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-background/95 border-border sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur lg:hidden">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="hover:bg-accent grid size-9 place-items-center rounded-md"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <span className="flex-1 truncate font-semibold">{APP_SHORT_NAME}</span>
          <button type="button" onClick={openSearch} className="hover:bg-accent grid size-9 place-items-center rounded-md" aria-label="Search">
            <Search className="size-5" />
          </button>
        </div>
        {banner ? <div data-slot="account-banner">{banner}</div> : null}
        <main className="flex-1 pb-12">{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        groups={[pageGroup, ...remote.groups]}
        onQueryChange={remote.onQueryChange}
        placeholder={search ? "Search courses, lessons, tests or jump to a page…" : "Jump to a page…"}
        status={remote.busy ? "Searching…" : undefined}
      />
    </div>
  );
}
