"use client";

/**
 * Tutor outcomes and reviews (viewer.md "Tutor outcomes and reviews"): the
 * Start review button, the manager's editor, and the tutor's reply.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgeReviewAction, createReviewAction, shareReviewAction, updateReviewAction } from "@/features/crm/actions";

const fail = (r: { serverError?: string } | null | undefined) => r?.serverError ?? "That didn't save. Check your connection and try again.";

export function StartReview({ membershipId, name, from, to }: { membershipId: string; name: string; from: string; to: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        const r = await createReviewAction({ membershipId, from: new Date(from), to: new Date(to) }).catch(() => null);
        setBusy(false);
        if (!r?.data) return setError(fail(r));
        router.push(`/dashboard/reviews/${r.data.id}`);
      }} aria-label={`Start a review for ${name}`}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Start review
      </Button>
      {error ? <span role="alert" className="text-destructive text-xs">{error}</span> : null}
    </span>
  );
}

export function ReviewEditor({ id, status, initial }: { id: string; status: "DRAFT" | "SHARED" | "ACKNOWLEDGED"; initial: { strengths: string; improvements: string; goals: string; rating: number | null } }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [busy, setBusy] = React.useState<"save" | "share" | "refresh" | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const locked = status === "ACKNOWLEDGED";

  async function save(share: boolean) {
    setMsg(null);
    setBusy(share ? "share" : "save");
    const r = await updateReviewAction({ id, strengths: v.strengths || null, improvements: v.improvements || null, goals: v.goals || null, rating: v.rating }).catch(() => null);
    if (!r?.data) { setBusy(null); return setMsg({ ok: false, text: fail(r) }); }
    if (share) {
      const s = await shareReviewAction({ id }).catch(() => null);
      setBusy(null);
      if (!s?.data) return setMsg({ ok: false, text: fail(s) });
      setMsg({ ok: true, text: "Shared. They've been told, and can read it and reply." });
    } else {
      setBusy(null);
      setMsg({ ok: true, text: status === "DRAFT" ? "Saved as a draft. Only managers can see it until you share it." : "Saved. They see the changes straight away." });
    }
    router.refresh();
  }

  async function refresh() {
    setBusy("refresh");
    const r = await updateReviewAction({ id, refreshOutcomes: true }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setMsg({ ok: false, text: fail(r) });
    setMsg({ ok: true, text: "Numbers updated with the latest data." });
    router.refresh();
  }

  const area = (k: "strengths" | "improvements" | "goals", label: string, hint: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`rv-${k}`} className="text-foreground text-sm font-medium">{label}</label>
      <Textarea id={`rv-${k}`} rows={4} value={v[k]} disabled={locked} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} maxLength={4000} placeholder={hint} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {area("strengths", "What went well", "For example: marks in Grade 10 Maths rose by 8 points on average.")}
      {area("improvements", "What to work on", "Be specific and kind: what, and how you'll help.")}
      {area("goals", "Goals for next period", "One to three goals you'll check at the next review.")}
      <fieldset className="flex flex-col gap-1.5" disabled={locked}>
        <legend className="text-foreground text-sm font-medium">Overall <span className="text-muted-foreground font-normal">(optional)</span></legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} out of 5`} aria-pressed={v.rating === n} onClick={() => setV((x) => ({ ...x, rating: x.rating === n ? null : n }))}
              className="text-muted-foreground hover:text-foreground rounded p-1 disabled:opacity-50">
              <Star aria-hidden className={v.rating != null && n <= v.rating ? "fill-amber-400 text-amber-500 size-5" : "size-5"} />
            </button>
          ))}
          <span className="text-muted-foreground ml-2 text-xs">{v.rating ? `${v.rating} of 5` : "No rating"}</span>
        </div>
      </fieldset>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-destructive text-sm"}>{msg.text}</p> : null}
      {locked ? (
        <p className="text-muted-foreground text-sm">They&apos;ve acknowledged this review, so it can&apos;t change. Start a new one for the next period.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" ? (
            <Button variant="brand" disabled={busy !== null} onClick={() => void save(true)}>{busy === "share" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Save and share</Button>
          ) : null}
          <Button variant={status === "DRAFT" ? "outline" : "brand"} disabled={busy !== null} onClick={() => void save(false)}>{busy === "save" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}{status === "DRAFT" ? "Save draft" : "Save changes"}</Button>
          <Button variant="ghost" disabled={busy !== null} onClick={() => void refresh()}><RefreshCw aria-hidden className={busy === "refresh" ? "size-4 animate-spin" : "size-4"} /> Update the numbers</Button>
        </div>
      )}
    </div>
  );
}

export function AcknowledgeReview({ id }: { id: string }) {
  const router = useRouter();
  const [response, setResponse] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form className="border-border flex flex-col gap-3 rounded-lg border p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      const r = await acknowledgeReviewAction({ id, response: response.trim() || null }).catch(() => null);
      setBusy(false);
      if (!r?.data) return setError(fail(r));
      router.refresh();
    }}>
      <label htmlFor="ack" className="text-foreground text-sm font-medium">Your reply <span className="text-muted-foreground font-normal">(optional)</span></label>
      <Textarea id="ack" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} maxLength={2000} placeholder="Anything you'd like to add, or questions about the goals." />
      <p className="text-muted-foreground text-xs">Acknowledging says you&apos;ve read it. It doesn&apos;t mean you agree with everything; say so in your reply if you don&apos;t.</p>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div><Button type="submit" variant="brand" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}I&apos;ve read it</Button></div>
    </form>
  );
}
