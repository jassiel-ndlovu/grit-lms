/** Cover by day. Server component; the buttons are in cover-actions.tsx. */

import { StatusChip } from "@/components/shell/status-chip";
import type { DateContext } from "@/lib/datetime";

import { byDay } from "../../lib/booking-ui";
import { dayLabel } from "../../lib/calendar-ui";
import { coverChip, coverLine, type CoverStatus } from "../../lib/staff-time-ui";
import type { CoverRow } from "../../staff-time";
import { CoverButtons } from "./cover-actions";

export function CoverDays({ rows, ctx, now, me, newestFirst = false }: {
  rows: readonly CoverRow[];
  ctx: DateContext & { timeZone: string; locale: string };
  now: Date;
  me: string | null;
  newestFirst?: boolean;
}) {
  const days = byDay(rows, (r) => r.startsAt, ctx.timeZone);
  if (newestFirst) {
    days.reverse();
    for (const d of days) d.items.reverse();
  }
  const time = new Intl.DateTimeFormat(ctx.locale, { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone });
  return (
    <div className="space-y-6">
      {days.map((d) => (
        <section key={d.day} aria-labelledby={`cover-${d.items[0].id}`} className="space-y-2">
          <h3 id={`cover-${d.items[0].id}`} className="text-foreground text-sm font-medium">
            {dayLabel(d.day, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <ul className="divide-border border-border divide-y rounded-lg border">
            {d.items.map((r) => {
              const status = r.status as CoverStatus;
              const chip = coverChip({ status, endsAt: r.endsAt }, now);
              const what = `${r.courseName}, ${dayLabel(d.day, ctx.locale)} at ${time.format(r.startsAt)}`;
              return (
                <li key={r.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                    <p className="text-foreground w-28 shrink-0 text-sm font-medium tabular-nums">
                      {time.format(r.startsAt)}–{time.format(r.endsAt)}
                    </p>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="text-foreground text-sm font-medium break-words">{r.courseName}</p>
                      <p className="text-muted-foreground text-xs">{coverLine({ status, absent: r.absent, cover: r.cover }, me)}</p>
                    </div>
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </div>
                  {r.reason ? <p className="text-foreground max-w-prose text-sm whitespace-pre-line sm:pl-32">{r.reason}</p> : null}
                  {status !== "CANCELLED" && r.endsAt > now ? (
                    <div className="flex flex-wrap gap-2 empty:hidden sm:pl-32">
                      <CoverButtons cover={{ id: r.id, status, cover: r.cover }} what={what} manages={r.manageable} mine={r.absent.membershipId === me} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
