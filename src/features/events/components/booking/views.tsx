/**
 * Booked lessons by day, and lessons left on packs. Server components; the
 * buttons are in booking-actions.tsx and credits.tsx.
 */

import { Video } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import type { BookingRow } from "@/features/booking/bookings";
import type { DateContext } from "@/lib/datetime";

import { bookingChip, byDay } from "../../lib/booking-ui";
import { dayLabel, joinOpen, meetingProvider, meetingProviderOf } from "../../lib/calendar-ui";
import { MeetingAppMark } from "../meeting-app-mark";
import { BookingLinkButton, CancelBookingButton, MarkBookingButtons } from "./booking-actions";

type Ctx = DateContext & { timeZone: string; locale: string };

export function BookingDays({
  rows, ctx, now, staff, showStudent, showTutor, newestFirst = false,
}: {
  rows: readonly BookingRow[];
  ctx: Ctx;
  now: Date;
  /** Shows marking and links, and words the cancel dialog for staff. */
  staff: boolean;
  showStudent: boolean;
  showTutor: boolean;
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
        <section key={d.day} aria-labelledby={`day-${d.day}`} className="space-y-2">
          <h2 id={`day-${d.day}`} className="text-foreground text-sm font-semibold">
            {dayLabel(d.day, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <ul className="divide-border border-border divide-y rounded-lg border">
            {d.items.map((b) => {
              const chip = bookingChip(b, now);
              const entry = { start: b.startsAt.toISOString(), end: b.endsAt.toISOString(), cancelled: b.status !== "BOOKED" };
              const live = joinOpen(entry, now);
              const started = b.startsAt <= now;
              const title = showStudent ? b.student.name : b.course.name;
              const sub = [showStudent ? b.course.name : null, showTutor ? `with ${b.tutor.name}` : null].filter(Boolean).join(" · ");
              const what = `${showStudent ? `${b.student.name}, ` : ""}${b.course.name}, ${dayLabel(d.day, ctx.locale)} at ${time.format(b.startsAt)}`;
              return (
                <li key={b.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                    <p className="text-foreground w-28 shrink-0 text-sm font-medium tabular-nums">
                      {time.format(b.startsAt)}–{time.format(b.endsAt)}
                    </p>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className={b.status === "CANCELLED" ? "text-muted-foreground text-sm font-medium line-through" : "text-foreground text-sm font-medium"}>{title}</p>
                      {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
                    </div>
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </div>
                  {b.note ? <p className="text-foreground max-w-prose text-sm whitespace-pre-line sm:pl-32">{b.note}</p> : null}
                  {b.status === "CANCELLED" && (b.cancelReason || b.usedCredit) ? (
                    <p className="text-muted-foreground text-xs sm:pl-32">
                      {[b.cancelReason, b.usedCredit ? (b.creditReturned ? "The lesson went back on the pack." : "The lesson didn't go back on the pack.") : null].filter(Boolean).join(" ")}
                    </p>
                  ) : null}
                  {b.status !== "CANCELLED" ? (
                    <div className="flex flex-wrap items-center gap-2 empty:hidden sm:pl-32">
                      {b.meetingLink && b.endsAt > now && b.status === "BOOKED" ? (
                        <Button asChild size="sm" variant={live ? "default" : "outline"}>
                          <a href={b.meetingLink} target="_blank" rel="noreferrer">
                            {live ? <Video aria-hidden className="size-4" /> : <MeetingAppMark provider={meetingProviderOf(b.meetingLink)} className="size-4" />}
                            {live ? "Join" : `Open ${meetingProvider(b.meetingLink) ?? "meeting"} link`}
                          </a>
                        </Button>
                      ) : null}
                      {staff && started ? <MarkBookingButtons bookingId={b.id} what={what} status={b.status} /> : null}
                      {staff && b.status === "BOOKED" && b.endsAt > now ? <BookingLinkButton bookingId={b.id} what={what} link={b.meetingLink} /> : null}
                      {b.canCancel ? (
                        <CancelBookingButton bookingId={b.id} what={what} usedCredit={b.usedCredit} cancelReturnsCredit={b.cancelReturnsCredit} staff={staff} />
                      ) : null}
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
