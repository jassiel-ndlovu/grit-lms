"use client";

/**
 * Service switches for one course (a/ux/03-billing.md §2). Each switch asks
 * for a preview first; a change that moves the course to another plan
 * opens a confirmation with the numbers from the preview, and any other
 * change applies at once. On an error the switch flips back and the
 * message shows under it.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { setCourseServices } from "@/features/billing/actions";

import { previewCourseServiceChange } from "../billing-actions";
import {
  TIER_LABEL,
  billingErrorMessage,
  canToggle,
  formatDelta,
  formatRand,
  groupServices,
  needsConfirm,
  type ServiceRow,
  type TierKey,
} from "../lib/billing-ui";

type Preview = {
  fromTier: TierKey;
  toTier: TierKey;
  seats: number;
  catchUpCents: number;
  nextRenewalDeltaCents: number;
  holdUntil: string | null;
};

type Pending = { key: string; name: string; on: boolean; preview: Preview };

export function CourseServices({
  courseId,
  courseName,
  items,
  inTrial,
  renewsOn,
  dateCtx,
}: {
  courseId: string;
  courseName: string;
  items: ServiceRow[];
  inTrial: boolean;
  /** "30 Dec", or null before the first payment. */
  renewsOn: string | null;
  dateCtx: { timeZone: string; locale: string };
}) {
  const router = useRouter();
  const [state, setState] = React.useState(() => new Map(items.map((s) => [s.key, s.enabled])));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState<Pending | null>(null);
  const groups = groupServices(items);
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(dateCtx.locale, { timeZone: dateCtx.timeZone, day: "numeric", month: "short" });

  async function apply(key: string, on: boolean) {
    const res = await setCourseServices({ courseId, enable: on ? [key] : [], disable: on ? [] : [key] });
    if (res?.serverError || !res?.data) throw new Error(billingErrorMessage(res?.serverError));
    router.refresh();
  }

  async function onToggle(s: ServiceRow, on: boolean) {
    setErrors((e) => ({ ...e, [s.key]: "" }));
    setBusy(s.key);
    setState((m) => new Map(m).set(s.key, on));
    try {
      const res = await previewCourseServiceChange({ courseId, enable: on ? [s.key] : [], disable: on ? [] : [s.key] });
      if (res?.serverError || !res?.data) throw new Error(billingErrorMessage(res?.serverError));
      if (needsConfirm(res.data)) {
        setPending({ key: s.key, name: s.name, on, preview: res.data });
        return; // the dialog applies or reverts
      }
      await apply(s.key, on);
    } catch (e) {
      setState((m) => new Map(m).set(s.key, !on));
      setErrors((x) => ({ ...x, [s.key]: e instanceof Error ? e.message : "We couldn't change this service just now. Try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!pending) return;
    const { key, on } = pending;
    setBusy(key);
    try {
      await apply(key, on);
    } catch (e) {
      setState((m) => new Map(m).set(key, !on));
      setErrors((x) => ({ ...x, [key]: e instanceof Error ? e.message : "We couldn't change this service just now. Try again." }));
    } finally {
      setBusy(null);
      setPending(null);
    }
  }

  function cancel() {
    if (pending) setState((m) => new Map(m).set(pending.key, !pending.on));
    setPending(null);
  }

  const p = pending?.preview;
  const up = p ? ["CORE", "PLUS", "PRO"].indexOf(p.toTier) > ["CORE", "PLUS", "PRO"].indexOf(p.fromTier) : false;

  return (
    <div className="space-y-8">
      <section aria-labelledby="included-heading" className="space-y-2">
        <h2 id="included-heading" className="text-foreground text-sm font-semibold">
          Included in every plan
        </h2>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {groups.included.map((n) => (
            <span key={n} className="inline-flex items-center gap-1">
              <Check aria-hidden className="text-brand-terracotta size-3.5" /> {n}
            </span>
          ))}
        </p>
      </section>

      {groups.tiers.map((g) => (
        <section key={g.tier} aria-labelledby={`tier-${g.tier}`} className="space-y-1">
          <h2 id={`tier-${g.tier}`} className="text-foreground text-sm font-semibold">
            {TIER_LABEL[g.tier]}
          </h2>
          <ul className="divide-border divide-y">
            {g.items.map((s) => {
              const on = state.get(s.key) ?? false;
              const allowed = canToggle(s);
              const id = `svc-${s.key}`;
              return (
                <li key={s.key} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={id} className="text-foreground text-sm font-medium">
                      {s.name}
                    </label>
                    {!allowed && s.reason === "READ_ONLY" ? (
                      <p className="text-muted-foreground text-xs">Locked until the overdue bill is paid.</p>
                    ) : null}
                    {!allowed && s.reason === "PAST_DUE" ? (
                      <p className="text-muted-foreground text-xs">Pay the overdue bill to move this course up a plan.</p>
                    ) : null}
                    {errors[s.key] ? (
                      <p role="alert" className="text-destructive text-xs">
                        {errors[s.key]}
                      </p>
                    ) : null}
                  </div>
                  {busy === s.key ? <Loader2 aria-hidden className="text-muted-foreground size-4 animate-spin" /> : null}
                  <Switch
                    id={id}
                    checked={on}
                    disabled={!allowed || busy !== null}
                    onCheckedChange={(v) => onToggle(s, v)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <AlertDialog open={pending !== null} onOpenChange={(o) => (!o ? cancel() : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Turn {pending?.on ? "on" : "off"} {pending?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {p ? (
                  <>
                    <p>
                      This moves {courseName} from {TIER_LABEL[p.fromTier]} to {TIER_LABEL[p.toTier]}.
                    </p>
                    {inTrial ? (
                      <p>It&apos;s free during your trial. The new plan applies once you start paying.</p>
                    ) : up ? (
                      <p>
                        The course is charged at {TIER_LABEL[p.toTier]} rates from now
                        {p.holdUntil ? `, and stays there until ${day(p.holdUntil)}` : ""}.
                        {p.catchUpCents > 0
                          ? ` The difference for this period (${p.seats} student${p.seats === 1 ? "" : "s"}, ${formatRand(p.catchUpCents)}) is recorded as owed.`
                          : ""}
                      </p>
                    ) : (
                      <p>There is no refund for the rest of this period.</p>
                    )}
                    {!inTrial ? (
                      <p className="text-foreground font-medium">
                        Your next payment{renewsOn ? ` on ${renewsOn}` : ""}: {formatDelta(p.nextRenewalDeltaCents)}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              {pending?.on ? "Turn on" : "Turn off"}
              {p ? ` and move to ${TIER_LABEL[p.toTier]}` : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
