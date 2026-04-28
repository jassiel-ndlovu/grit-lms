"use client";

/**
 * NotificationListItem — one row in the full notifications page.
 *
 * Client component because the row is interactive: clicking the body
 * marks the notification as read and navigates to its `link`. The
 * "Mark unread" / "Mark read" toggle on the right-hand side is similarly
 * driven by Server Actions and uses a useTransition() spinner.
 *
 * Visual state is derived from props directly — the parent RSC re-renders
 * with fresh data after each action's revalidatePath fires.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { markNotificationRead, markNotificationUnread } from "../actions";
import type { NotificationListItem as NotificationRow } from "../queries";
import { NotificationIcon } from "./notification-icon";

export interface NotificationListItemProps {
  notification: NotificationRow;
}

export function NotificationListItem({
  notification,
}: NotificationListItemProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const isUrgent = notification.priority === "URGENT";
  const isHigh = notification.priority === "HIGH";

  function navigateIfPossible() {
    if (notification.link) {
      router.push(notification.link);
    }
  }

  function handleRowClick() {
    if (notification.isRead) {
      navigateIfPossible();
      return;
    }
    startTransition(async () => {
      try {
        const result = await markNotificationRead({ id: notification.id });
        if (result?.serverError) throw new Error(result.serverError);
        navigateIfPossible();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  function handleToggleClick(e: React.MouseEvent) {
    // Don't bubble — the parent row handler also wants to navigate.
    e.stopPropagation();
    startTransition(async () => {
      try {
        const result = notification.isRead
          ? await markNotificationUnread({ id: notification.id })
          : await markNotificationRead({ id: notification.id });
        if (result?.serverError) throw new Error(result.serverError);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        "hover:bg-muted/60 group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
        !notification.isRead && "bg-primary/[0.04]",
      )}
    >
      <div
        className={cn(
          "mt-0.5 rounded-md p-2",
          notification.isRead
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        <NotificationIcon type={notification.type} className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "truncate text-sm",
                  !notification.isRead ? "font-semibold" : "font-medium",
                )}
              >
                {notification.title}
              </p>
              {isUrgent && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                  Urgent
                </Badge>
              )}
              {isHigh && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  High
                </Badge>
              )}
              {!notification.isRead && (
                <span
                  aria-hidden
                  className="bg-primary size-1.5 rounded-full"
                />
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {notification.message}
            </p>
            <p className="text-muted-foreground/80 mt-1.5 inline-flex items-center gap-1 text-xs">
              <Clock className="size-3" />
              {formatRelative(notification.createdAt)}
              {notification.readAt && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Check className="size-3" />
                  Read {formatRelative(notification.readAt)}
                </span>
              )}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={handleToggleClick}
            disabled={pending}
            aria-label={
              notification.isRead ? "Mark as unread" : "Mark as read"
            }
            title={notification.isRead ? "Mark as unread" : "Mark as read"}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : notification.isRead ? (
              <Undo2 className="size-3.5" />
            ) : (
              <Check className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
