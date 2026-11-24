"use client";

/**
 * EntryDialog — one calendar entry opened (#149).
 *
 * Everyone: when and where, the Join button for a pasted meeting link
 * (live from 15 minutes before the start) and "Add to my calendar" (A's
 * per-event .ics). Learners: Check in, while the session is on. Staff who
 * may edit the course: Take attendance, Edit (with A's scopes, in
 * EventForm), Cancel or restore this one session (a "this one only"
 * exception), and Delete. Writes are locked in a read-only workspace.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarPlus, ClipboardCheck, ExternalLink, Loader2, MapPin, Pencil, Presentation, Repeat, RotateCcw, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WriteGuard } from "@/components/shell/workspace-access";
import { editCourseEventOccurrence } from "@/features/calendar/actions";

import { deleteCourseEvent, getCourseEventSeries } from "../actions";
import type { CalendarCover } from "../staff-time";
import { calendarRoutes, joinOpen, meetingProvider, meetingProviderOf, takesAttendance, type CalendarEntry } from "../lib/calendar-ui";
import { iconFor, labelFor } from "./entry-meta";
import { CheckInButton } from "./calendar-tools";
import { EntryCover } from "./staff-time/entry-cover";
import { EventForm, type EventSeries } from "./event-form";
import { MeetingAppMark } from "./meeting-app-mark";

export type EntryContext = {
  /** The viewer's zone: every time on the page is shown in it. */
  timeZone: string;
  locale: string;
  /** Courses whose events this viewer may change (staff). */
  editableCourseIds: string[];
  /** A learner's courses with check-in codes (Plus). Empty for everyone else. */
  checkInCourseIds: string[];
  /** Cover for absent tutors (organisations' staff). */
  cover?: CalendarCover | null;
  /** Staff and learners open class mode; parents don't. */
  classMode?: boolean;
};

export function EntryDialog({ entry, onClose, ctx }: { entry: CalendarEntry | null; onClose: () => void; ctx: EntryContext }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "edit" | "cancel" | "delete">(null);
  const [editing, setEditing] = React.useState<{ series: EventSeries; entry: CalendarEntry } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const e = entry;
  const canEdit = Boolean(e && e.kind === "event" && ctx.editableCourseIds.includes(e.courseId));
  const fmtDay = new Intl.DateTimeFormat(ctx.locale, { weekday: "long", day: "numeric", month: "long", timeZone: ctx.timeZone });
  const fmtTime = new Intl.DateTimeFormat(ctx.locale, { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone });

  async function openEdit() {
    if (!e?.eventId) return;
    setBusy("edit");
    const r = await getCourseEventSeries({ id: e.eventId });
    setBusy(null);
    if (!r?.data) return toast.error(r?.serverError ?? "Couldn't load this event");
    setEditing({ series: r.data as EventSeries, entry: e });
    onClose();
  }

  async function setCancelled(cancelled: boolean) {
    if (!e?.eventId || !e.occurrenceStart) return;
    setBusy("cancel");
    const r = await editCourseEventOccurrence({ eventId: e.eventId, occurrenceStart: e.occurrenceStart, scope: "THIS", changes: { cancelled } });
    setBusy(null);
    if (r?.serverError) return toast.error(r.serverError);
    toast.success(cancelled ? "Session cancelled" : "Session restored");
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!e?.eventId) return;
    setBusy("delete");
    const r = await deleteCourseEvent({ id: e.eventId });
    setBusy(null);
    setConfirmDelete(false);
    if (r?.serverError) return toast.error(r.serverError);
    toast.success(e.recurring ? "Series deleted" : "Event deleted");
    onClose();
    router.refresh();
  }

  const Icon = e ? iconFor(e) : CalendarPlus;
  const provider = meetingProvider(e?.link);
  const live = Boolean(e && joinOpen(e, new Date()));

  return (
    <>
      <Dialog open={e !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          {e && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span className="bg-muted text-foreground grid size-10 shrink-0 place-items-center rounded-md">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <DialogTitle className={e.cancelled ? "text-muted-foreground line-through" : undefined}>{e.title}</DialogTitle>
                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{labelFor(e)}</Badge>
                      {e.cancelled && <Badge variant="destructive">Cancelled</Badge>}
                      {!e.cancelled && e.changed && <Badge variant="outline">Changed for this date</Badge>}
                      {e.recurring && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Repeat aria-hidden className="size-3" />
                          Repeats
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="sr-only">When</dt>
                  <dd className="tabular-nums">
                    {fmtDay.format(new Date(e.start))}, {fmtTime.format(new Date(e.start))}
                    {e.end ? `–${fmtTime.format(new Date(e.end))}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Course</dt>
                  <dd className="text-muted-foreground">{e.courseName}</dd>
                </div>
                {e.location && (
                  <div className="flex items-center gap-1.5">
                    <dt>
                      <MapPin aria-label="Place" className="text-muted-foreground size-3.5" />
                    </dt>
                    <dd>{e.location}</dd>
                  </div>
                )}
                {e.description && (
                  <div>
                    <dt className="sr-only">Notes</dt>
                    <dd className="text-foreground whitespace-pre-wrap">{e.description}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-2">
                {e.link && !e.cancelled && (
                  <Button asChild variant={live ? "default" : "outline"} size="sm">
                    <a href={e.link} target="_blank" rel="noreferrer">
                      {live ? <Video aria-hidden className="size-4" /> : <MeetingAppMark provider={meetingProviderOf(e.link)} className="size-4" />}
                      {live ? "Join" : `Open ${provider ?? "meeting"} link`}
                    </a>
                  </Button>
                )}
                {ctx.classMode && takesAttendance(e) && e.eventId && e.occurrenceStart && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={calendarRoutes.classMode(e.eventId, e.occurrenceStart)}>
                      <Presentation aria-hidden className="size-4" />
                      Class page
                    </Link>
                  </Button>
                )}
                {live && takesAttendance(e) && ctx.checkInCourseIds.includes(e.courseId) && <CheckInButton size="sm" />}
                {e.href && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={e.href}>
                      <ExternalLink className="size-4" />
                      Open
                    </Link>
                  </Button>
                )}
                {e.eventId && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={calendarRoutes.ics(e.eventId)} download>
                      <CalendarPlus className="size-4" />
                      Add to my calendar
                    </a>
                  </Button>
                )}
              </div>

              {ctx.cover && <EntryCover entry={e} cover={ctx.cover} when={`${fmtDay.format(new Date(e.start))} at ${fmtTime.format(new Date(e.start))}`} />}

              {canEdit && (
                <div className="border-border flex flex-wrap gap-2 border-t pt-4">
                  {takesAttendance(e) && e.occurrenceStart && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={calendarRoutes.attendance(e.eventId!, e.occurrenceStart)}>
                        <ClipboardCheck className="size-4" />
                        Take attendance
                      </Link>
                    </Button>
                  )}
                  <WriteGuard label="Edit">
                    <Button size="sm" variant="outline" onClick={openEdit} disabled={busy !== null}>
                      {busy === "edit" ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                      Edit
                    </Button>
                  </WriteGuard>
                  {e.recurring || e.cancelled ? (
                    <WriteGuard label={e.cancelled ? "Restore" : "Cancel this session"}>
                      <Button size="sm" variant="outline" onClick={() => setCancelled(!e.cancelled)} disabled={busy !== null}>
                        {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : e.cancelled ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                        {e.cancelled ? "Restore" : "Cancel this session"}
                      </Button>
                    </WriteGuard>
                  ) : null}
                  <WriteGuard label="Delete">
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                      <Trash2 className="size-4" />
                      {e.recurring ? "Delete series" : "Delete"}
                    </Button>
                  </WriteGuard>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{e?.recurring ? "Delete every session in this series?" : "Delete this event?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {e?.recurring
                ? "Every date goes, past ones too, with their attendance. To skip one date, cancel that session instead."
                : "It goes for everyone on the course, with any attendance taken."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(ev) => (ev.preventDefault(), remove())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy === "delete" && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>{editing?.entry.courseName}</DialogDescription>
          </DialogHeader>
          {editing && (
            <EventForm
              courseId={editing.entry.courseId}
              timeZone={editing.series.timeZone}
              series={editing.series}
              occurrence={
                editing.entry.occurrenceStart
                  ? {
                      occurrenceStart: editing.entry.occurrenceStart,
                      start: editing.entry.start,
                      end: editing.entry.end,
                      title: editing.entry.title,
                      description: editing.entry.description,
                      location: editing.entry.location,
                      link: editing.entry.link,
                    }
                  : undefined
              }
              onSuccess={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
