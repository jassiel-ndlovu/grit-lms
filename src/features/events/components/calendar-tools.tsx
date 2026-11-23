"use client";

/**
 * Calendar tools (#149):
 *   CheckInButton    a learner types the code the tutor shows (A's `checkIn`)
 *   SubscribeButton  "Subscribe in your calendar app": A's private ICS feed
 *                    (`getCalendarFeedUrl`), with copy and a new link. Each
 *                    call replaces the last link, so nothing is fetched
 *                    until the person asks.
 */

import * as React from "react";
import { CalendarDays, CalendarPlus, Check, CheckCircle2, Copy, Loader2, Rss, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkIn, getCalendarFeedUrl } from "@/features/calendar/actions";

import { attendanceLabel, googleSubscribeUrl, tidyCode } from "../lib/calendar-ui";

export function CheckInButton({ size = "default", variant = "outline" }: { size?: "sm" | "default"; variant?: "outline" | "default" }) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<null | { ok: true; title: string; status: string } | { ok: false }>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (code.length < 4) return;
    setBusy(true);
    const r = await checkIn({ code });
    setBusy(false);
    if (r?.serverError) return toast.error(r.serverError);
    setResult(r?.data ?? { ok: false });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setCode("");
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <ScanLine className="size-4" />
          Check in
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check in to your session</DialogTitle>
          <DialogDescription>Type the code your tutor is showing.</DialogDescription>
        </DialogHeader>
        {result?.ok ? (
          <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 aria-hidden className="size-10" />
            <p className="font-medium">You&apos;re checked in</p>
            <p className="text-muted-foreground text-sm">
              {result.title}: {attendanceLabel(result.status).toLowerCase()}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="check-in-code">Code</Label>
              <Input
                id="check-in-code"
                value={code}
                onChange={(e) => {
                  setCode(tidyCode(e.target.value));
                  setResult(null);
                }}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="ABC123"
                className="h-12 text-center font-mono text-2xl tracking-[0.3em] uppercase"
                aria-invalid={result?.ok === false}
                aria-describedby={result?.ok === false ? "check-in-error" : undefined}
              />
              {result?.ok === false && (
                <p id="check-in-error" className="text-destructive text-sm">
                  That code didn&apos;t work. It may have expired: ask your tutor for the current one.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length < 4}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Check in
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SubscribeButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [feed, setFeed] = React.useState<{ url: string; webcal: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function makeLink() {
    setBusy(true);
    const r = await getCalendarFeedUrl({});
    setBusy(false);
    if (!r?.data) return toast.error(r?.serverError ?? "Couldn't make a link");
    setFeed(r.data);
    setCopied(false);
  }

  async function copy() {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={compact ? "Subscribe in your calendar app" : undefined}>
          <Rss className="size-4" />
          <span className={compact ? "sr-only sm:not-sr-only" : undefined}>Subscribe</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe in your calendar app</DialogTitle>
          <DialogDescription>
            Your Nexa sessions show up in Google Calendar, Apple Calendar or Outlook and stay up to date. Google can take up to a day to pick up a change.
          </DialogDescription>
        </DialogHeader>
        {feed ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="feed-url">Your private link</Label>
              <div className="flex gap-2">
                <Input id="feed-url" readOnly value={feed.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copy} aria-label="Copy link">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">Anyone with this link can see your timetable. Don&apos;t share it.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={googleSubscribeUrl(feed.webcal)} target="_blank" rel="noreferrer">
                  <CalendarPlus aria-hidden className="size-4" />
                  Add to Google Calendar
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={feed.webcal}>
                  <CalendarDays aria-hidden className="size-4" />
                  Open in calendar app
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Getting a link turns off any link you made before.</p>
        )}
        <DialogFooter>
          <Button type="button" variant={feed ? "ghost" : "default"} onClick={makeLink} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {feed ? "Make a new link" : "Get my link"}
          </Button>
        </DialogFooter>
        {feed && <p className="text-muted-foreground -mt-2 text-right text-xs">A new link stops the old one working.</p>}
      </DialogContent>
    </Dialog>
  );
}
