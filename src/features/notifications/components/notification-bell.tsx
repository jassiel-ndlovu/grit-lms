"use client";

/**
 * NotificationBell — dropdown trigger that lives in the dashboard header.
 *
 * The bell is a fully self-contained Client component:
 *   - On mount it calls `getNotificationsForBell()` to load the unread
 *     count + the latest few rows.
 *   - On click of a row it fires `markNotificationRead`, navigates to the
 *     row's link, then re-fetches.
 *   - "Mark all read" calls `markAllNotificationsRead` and re-fetches.
 *
 * No polling — freshness model is "revalidate on Server Action only" per
 * the chapter scope. Cross-user creates (e.g., a tutor publishes a lesson)
 * land on the next mount/refresh.
 *
 * The bell is Student-only: it should be conditionally rendered by the
 * parent based on session role.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  getNotificationsForBell,
  markAllNotificationsRead,
  markNotificationRead,
} from "../actions";
import type { NotificationListItem } from "../queries";
import { NotificationIcon } from "./notification-icon";

const DEFAULT_LIMIT = 8;

export interface NotificationBellProps {
  /** Override the dropdown row cap. Defaults to 8. */
  limit?: number;
  className?: string;
}

export function NotificationBell({
  limit = DEFAULT_LIMIT,
  className,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<NotificationListItem[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [, startTransition] = React.useTransition();

  const refetch = React.useCallback(async () => {
    const result = await getNotificationsForBell({ limit });
    if (result?.serverError) {
      // The bell is best-effort — surface but don't crash.
      console.error("[NotificationBell] failed to load:", result.serverError);
      return;
    }
    if (result?.data) {
      setItems(result.data.items);
      setUnread(result.data.unreadCount);
    }
    setLoading(false);
  }, [limit]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  function handleRowClick(n: NotificationListItem) {
    setOpen(false);

    // Optimistic — flip locally so the dropdown state matches what the
    // user just clicked, even before the action resolves.
    if (!n.isRead) {
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, isRead: true } : p)),
      );
      setUnread((c) => Math.max(0, c - 1));
    }

    startTransition(async () => {
      try {
        if (!n.isRead) {
          const result = await markNotificationRead({ id: n.id });
          if (result?.serverError) {
            throw new Error(result.serverError);
          }
        }
        if (n.link) {
          router.push(n.link);
        }
        // Pull fresh server state once navigation kicks off.
        void refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
        // Roll back the optimistic flip.
        void refetch();
      }
    });
  }

  function handleMarkAllRead() {
    if (unread === 0) return;

    // Optimistic flip.
    setItems((prev) => prev.map((p) => ({ ...p, isRead: true })));
    setUnread(0);

    startTransition(async () => {
      try {
        const result = await markAllNotificationsRead({});
        if (result?.serverError) {
          throw new Error(result.serverError);
        }
        toast.success("All notifications marked as read");
        void refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
        void refetch();
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            unread > 0
              ? `Notifications (${unread} unread)`
              : "Notifications"
          }
          className={cn("relative", className)}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifications</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {unread} new
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleMarkAllRead}
            disabled={unread === 0}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        </div>
        <Separator />

        {/* Body */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground px-3 py-6 text-center text-sm">
              <Bell className="text-muted-foreground/50 mx-auto mb-2 size-6" />
              <p>You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(n)}
                    className={cn(
                      "hover:bg-muted/60 flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                      !n.isRead && "bg-primary/[0.04]",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 rounded-md p-1.5",
                        n.isRead
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <NotificationIcon type={n.type} className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            !n.isRead ? "font-medium" : "font-normal",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span
                            aria-hidden
                            className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {n.message}
                      </p>
                      <p className="text-muted-foreground/80 mt-1 text-[11px]">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="p-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setOpen(false)}
          >
            <Link href="/dashboard/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact relative time formatter — the bell needs short labels and we
 * deliberately avoid pulling in a date library. Shows "just now",
 * "5m ago", "3h ago", "2d ago", or the locale date for older items.
 */
function formatRelative(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
