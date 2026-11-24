"use client";

/**
 * Lessons left on prepaid packs: a family's list with Buy (once billing is
 * on), and the staff correction on a student's page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustLessonCreditsAction, buyLessonPackAction } from "@/features/booking/actions";
import type { CreditSummary } from "@/features/booking/credits";
import { formatRand } from "@/features/courses/lib/billing-ui";

import { lessonsLeft, parseAdjustment } from "../../lib/booking-ui";

const FAILED = "That didn't work. Try again.";

export type CreditList = { learnerId: string; name: string; payer: boolean; courses: CreditSummary[] };

export function FamilyCredits({ lists, withName, forSale }: { lists: CreditList[]; withName: boolean; forSale: boolean }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {lists.flatMap((l) =>
        l.courses.map((c) => (
          <li key={`${l.learnerId}:${c.courseId}`} className="space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-foreground text-sm font-medium">{withName ? `${l.name} · ${c.courseName}` : c.courseName}</p>
              <p className={c.balance < 1 ? "text-muted-foreground text-sm tabular-nums" : "text-foreground text-sm tabular-nums"}>{lessonsLeft(Math.max(0, c.balance))}</p>
            </div>
            {forSale && l.payer && c.packs.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {c.packs.map((p) => (
                  <li key={p.id}>
                    <BuyPackButton learnerId={l.learnerId} pack={p} />
                  </li>
                ))}
              </ul>
            ) : c.needsCredits && c.balance < 1 ? (
              <p className="text-muted-foreground text-xs">{l.payer ? "Ask the tutor about a lesson pack." : "Ask your parent or your tutor about a lesson pack."}</p>
            ) : null}
          </li>
        )),
      )}
    </ul>
  );
}

function BuyPackButton({ learnerId, pack }: { learnerId: string; pack: CreditSummary["packs"][number] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function buy() {
    setPending(true);
    const r = await buyLessonPackAction({ feeScheduleId: pack.id, learnerId }).catch(() => null);
    if (!r?.data) {
      setPending(false);
      toast.error(r?.serverError ?? FAILED);
      return;
    }
    // The invoice is open; Fees has the checkout.
    router.push("/dashboard/fees");
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={buy}>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShoppingCart aria-hidden className="size-4" />}
      {pack.description}: {formatRand(pack.amountCents)}
    </Button>
  );
}

/** Staff with `fees.manage`: balances for one student, with a correction. */
export function StaffCredits({ learnerId, studentName, courses }: { learnerId: string; studentName: string; courses: CreditSummary[] }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {courses.map((c) => (
        <li key={c.courseId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">{c.courseName}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {lessonsLeft(c.balance)}
              {c.needsCredits ? "" : " · no pack on sale, so bookings are free"}
            </p>
          </div>
          <AdjustCreditsButton learnerId={learnerId} studentName={studentName} course={c} />
        </li>
      ))}
    </ul>
  );
}

function AdjustCreditsButton({ learnerId, studentName, course }: { learnerId: string; studentName: string; course: CreditSummary }) {
  const router = useRouter();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [direction, setDirection] = React.useState<"add" | "remove">("add");
  const [lessons, setLessons] = React.useState("1");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseAdjustment(lessons, direction);
    if (n === null) return setError("Use a whole number from 1 to 100.");
    if (note.trim().length < 3) return setError("Say why, so it's clear later.");
    setPending(true);
    setError(null);
    const r = await adjustLessonCreditsAction({ learnerId, courseId: course.courseId, lessons: n, note: note.trim() }).catch(() => null);
    setPending(false);
    if (!r?.data) return setError(r?.serverError ?? FAILED);
    setOpen(false);
    toast.success(`${lessonsLeft(r.data.balance)} for ${studentName}.`);
    router.refresh();
  }

  return (
    <WriteGuard label="Change">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Change lessons left: ${course.courseName}`}
        onClick={() => {
          setDirection("add");
          setLessons("1");
          setNote("");
          setError(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        Change
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Change lessons left</DialogTitle>
              <DialogDescription>
                {studentName}, {course.courseName}: {lessonsLeft(course.balance)}. Use this for cash or a goodwill lesson; packs paid through Nexa are added for you.
              </DialogDescription>
            </DialogHeader>
            <div role="radiogroup" aria-label="Add or remove" className="flex gap-2">
              {(["add", "remove"] as const).map((d) => (
                <Button key={d} type="button" size="sm" role="radio" aria-checked={direction === d} variant={direction === d ? "default" : "outline"} onClick={() => setDirection(d)}>
                  {d === "add" ? <Plus aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
                  {d === "add" ? "Add" : "Remove"}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-n`}>Lessons</Label>
              <Input id={`${id}-n`} inputMode="numeric" className="w-24" value={lessons} maxLength={3} onChange={(e) => setLessons(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-w`}>Why</Label>
              <Input id={`${id}-w`} value={note} maxLength={300} placeholder="Paid cash for 5 lessons" onChange={(e) => setNote(e.target.value)} />
            </div>
            {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
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
