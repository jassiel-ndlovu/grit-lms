"use client";

/**
 * Free lesson times for a week: pick one, confirm it in a dialog. A checks
 * the time is still free when it's booked.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookSessionAction } from "@/features/booking/actions";

import { bookingRoutes, cancelRule, lessonsLeft } from "../../lib/booking-ui";

/** One free time, with its labels already in the page's zone. */
export type SlotOption = { membershipId: string; tutor: string; start: string; time: string; range: string };
export type SlotDay = { day: string; label: string; slots: SlotOption[] };

const FAILED = "That didn't work. Try again.";

export function SlotPicker({
  courseId, courseName, learnerId, studentName, days, manyTutors, credits, cancelHours, staff,
}: {
  courseId: string;
  courseName: string;
  learnerId: string;
  /** The student to name in the dialog: a child, or staff's student. Null for a student booking for themself. */
  studentName: string | null;
  days: SlotDay[];
  manyTutors: boolean;
  credits: { needed: boolean; balance: number };
  cancelHours: number;
  staff: boolean;
}) {
  const router = useRouter();
  const noteId = React.useId();
  const [picked, setPicked] = React.useState<{ slot: SlotOption; day: string } | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const out = credits.needed && credits.balance < 1;

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setPending(true);
    setError(null);
    const r = await bookSessionAction({ courseId, membershipId: picked.slot.membershipId, startsAt: new Date(picked.slot.start), learnerId, note: note.trim() || null }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      setError(r?.serverError ?? FAILED);
      // Someone may have taken it: show what's free now.
      router.refresh();
      return;
    }
    setPicked(null);
    toast.success(r.data.creditsLeft === null ? "Lesson booked." : `Lesson booked. ${lessonsLeft(r.data.creditsLeft)}.`);
    // Staff often book several; families go and see it.
    if (!staff) router.push(bookingRoutes.home);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-5">
        {days.map((d) => (
          <section key={d.day} aria-labelledby={`slots-${d.day}`} className="space-y-2">
            <h3 id={`slots-${d.day}`} className="text-foreground text-sm font-semibold">
              {d.label}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {d.slots.map((s) => (
                <li key={`${s.membershipId}:${s.start}`}>
                  <WriteGuard label={s.time}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={out}
                      aria-label={`${d.label}, ${s.range}, with ${s.tutor}`}
                      className="h-auto min-h-8 flex-col items-start gap-0 py-1.5 tabular-nums"
                      onClick={() => {
                        setNote("");
                        setError(null);
                        setPicked({ slot: s, day: d.label });
                      }}
                    >
                      {s.time}
                      {manyTutors ? <span className="text-muted-foreground text-xs font-normal">{s.tutor}</span> : null}
                    </Button>
                  </WriteGuard>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="sm:max-w-md">
          {picked ? (
            <form onSubmit={book} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Book this lesson?</DialogTitle>
                <DialogDescription>
                  {studentName ? `For ${studentName}. ` : ""}
                  {courseName} with {picked.slot.tutor}, {picked.day}, {picked.slot.range}.
                </DialogDescription>
              </DialogHeader>
              {credits.needed ? (
                <p className="bg-muted/60 text-foreground rounded-md px-3 py-2 text-sm">
                  Uses 1 lesson from the pack. {lessonsLeft(credits.balance - 1)} after this. {staff ? null : cancelRule(cancelHours)}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={noteId}>{staff ? "Note (optional)" : "What would you like to work on? (optional)"}</Label>
                <Textarea id={noteId} value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
              </div>
              {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPicked(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <CalendarCheck aria-hidden className="size-4" />}
                  Book
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
