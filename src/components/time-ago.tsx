"use client";

/**
 * <TimeAgo> — a relative timestamp ("5 minutes ago") computed in the
 * browser, in the user's time zone, refreshed every 30 seconds. Hover for
 * the exact date and time.
 *
 * The server and the first client render show the absolute time instead:
 * a relative label computed during SSR goes stale as soon as the page is
 * cached or left open, and depends on the server's clock.
 */

import * as React from "react";

import { useDateContext } from "@/components/preferences-provider";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";

export interface TimeAgoProps {
  date: Date | string;
  /** Prefix for the hover title, e.g. "Sent". */
  titlePrefix?: string;
  className?: string;
}

export function TimeAgo({ date, titlePrefix, className }: TimeAgoProps) {
  const ctx = useDateContext();
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const d = typeof date === "string" ? new Date(date) : date;
  const absolute = formatDateTime(d, ctx);

  return (
    <time
      dateTime={d.toISOString()}
      title={titlePrefix ? `${titlePrefix} ${absolute}` : absolute}
      className={className}
      suppressHydrationWarning
    >
      {now === null ? absolute : formatRelativeTime(d, now, ctx)}
    </time>
  );
}

/** The exact time, in the user's zone — for "sent at" labels. */
export function DateTimeText({
  date,
  options,
  className,
}: {
  date: Date | string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const ctx = useDateContext();
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {formatDateTime(d, ctx, options)}
    </time>
  );
}
