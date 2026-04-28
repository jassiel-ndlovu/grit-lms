"use client";

/**
 * MarkAllReadButton — destructive-flavoured action used at the top of the
 * full notifications page. Disabled when nothing is unread.
 *
 * Optimistic UI: the parent re-renders from server state after refresh,
 * but the button itself disables immediately so the user can't double-fire
 * the action while the transition is pending.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { markAllNotificationsRead } from "../actions";

export interface MarkAllReadButtonProps {
  /** Whether the button is enabled — typically driven by `unreadCount > 0`. */
  hasUnread: boolean;
  className?: string;
}

export function MarkAllReadButton({
  hasUnread,
  className,
}: MarkAllReadButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const result = await markAllNotificationsRead({});
        if (result?.serverError) {
          throw new Error(result.serverError);
        }
        toast.success("All notifications marked as read");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={!hasUnread || pending}
      className={className}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCheck className="size-4" />
      )}
      Mark all read
    </Button>
  );
}
