"use client";

/**
 * What people do with a booked lesson: cancel it, mark it (staff), add the
 * online link (staff). A's actions check everything again.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, UserX, X } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelBookingAction, markBookingAction, setBookingLinkAction } from "@/features/booking/actions";

import { cancelledToast, cancelNote } from "../../lib/booking-ui";

const FAILED = "That didn't work. Try again.";

export function CancelBookingButton({
  bookingId, what, usedCredit, cancelReturnsCredit, staff,
}: {
  bookingId: string;
  /** "Thandi's lesson on Tue 1 Dec, 15:00", for the dialog. */
  what: string;
  usedCredit: boolean;
  cancelReturnsCredit: boolean;
  staff: boolean;
}) {
  const router = useRouter();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function cancel() {
    setPending(true);
    const r = await cancelBookingAction({ bookingId, reason: reason.trim() || null }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    toast.success(cancelledToast(r.data.creditReturned, usedCredit));
    router.refresh();
  }

  return (
    <WriteGuard label="Cancel">
      <Button type="button" size="sm" variant="ghost" aria-label={`Cancel ${what}`} onClick={() => setOpen(true)}>
        <X aria-hidden className="size-4" />
        Cancel
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              {what}. {cancelNote({ usedCredit, cancelReturnsCredit }, staff)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>Reason (optional)</Label>
            <Textarea id={id} value={reason} maxLength={300} rows={2} onChange={(e) => setReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void cancel();
              }}
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
              Cancel lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WriteGuard>
  );
}

/** Done or no-show, once the lesson has started. */
export function MarkBookingButtons({ bookingId, what, status }: { bookingId: string; what: string; status: "BOOKED" | "COMPLETED" | "NO_SHOW" }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<null | "COMPLETED" | "NO_SHOW">(null);

  async function mark(next: "COMPLETED" | "NO_SHOW") {
    setPending(next);
    const r = await markBookingAction({ bookingId, status: next }).catch(() => null);
    setPending(null);
    if (!r?.data) {
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    toast.success(next === "COMPLETED" ? "Marked done." : "Marked as a no-show.");
    router.refresh();
  }

  const done = status === "BOOKED" ? "Done" : "Change to done";
  const noShow = status === "BOOKED" ? "No-show" : "Change to no-show";

  return (
    <>
      {status !== "COMPLETED" ? (
        <WriteGuard label={done}>
          <Button type="button" size="sm" variant={status === "BOOKED" ? "outline" : "ghost"} disabled={pending !== null} aria-label={`${done}: ${what}`} onClick={() => mark("COMPLETED")}>
            {pending === "COMPLETED" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            {done}
          </Button>
        </WriteGuard>
      ) : null}
      {status !== "NO_SHOW" ? (
        <WriteGuard label={noShow}>
          <Button type="button" size="sm" variant="ghost" disabled={pending !== null} aria-label={`${noShow}: ${what}`} onClick={() => mark("NO_SHOW")}>
            {pending === "NO_SHOW" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserX aria-hidden className="size-4" />}
            {noShow}
          </Button>
        </WriteGuard>
      ) : null}
    </>
  );
}

export function BookingLinkButton({ bookingId, what, link }: { bookingId: string; what: string; link: string | null }) {
  const router = useRouter();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = link ? "Change link" : "Add link";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await setBookingLinkAction({ bookingId, meetingLink: value.trim() || null }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      setError(r?.serverError ?? FAILED);
      return;
    }
    setOpen(false);
    toast.success(value.trim() ? "Link saved." : "Link removed.");
    router.refresh();
  }

  return (
    <WriteGuard label={label}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`${label}: ${what}`}
        onClick={() => {
          setValue(link ?? "");
          setError(null);
          setOpen(true);
        }}
      >
        <Link2 aria-hidden className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Online link</DialogTitle>
              <DialogDescription>For {what}. Leave it empty to remove it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={id}>Meeting link</Label>
              <Input id={id} type="url" inputMode="url" value={value} maxLength={500} placeholder="https://" aria-invalid={error !== null} onChange={(e) => setValue(e.target.value)} />
              {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}
