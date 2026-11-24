"use client";

/**
 * The contact form for people who aren't signed in (support.md). It goes to
 * Nexa support; the person gets an email with their reference and a private
 * link. Same bot screen as the landing-page enquiry.
 */

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { submitPublicQueryAction } from "../actions";
import { KIND_LABEL, SUPPORT_KINDS, SUPPORT_LIMITS, TOPIC_LABEL, topicsFor, type SupportKind, type SupportTopic } from "../support-rules";
import { supportErrorMessage } from "../support-ui";

export function PublicQueryForm() {
  const [startedAt] = React.useState(() => Date.now());
  const [kind, setKind] = React.useState<SupportKind>("QUESTION");
  const [topic, setTopic] = React.useState<SupportTopic | "">("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!topic) return setError("Choose what your message is about.");
    setBusy(true);
    const r = await submitPublicQueryAction({ kind, topic, name, email, subject, message, startedAt, website }).catch(() => null);
    setBusy(false);
    if (!r?.data) {
      const v = r?.validationErrors as Record<string, { _errors?: string[] }> | undefined;
      const first = v && Object.values(v).find((x) => x?._errors?.length)?._errors?.[0];
      return setError(first ?? supportErrorMessage(r?.serverError));
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div role="status" className="border-border flex flex-col gap-2 rounded-lg border p-5">
        <p className="text-foreground flex items-center gap-2 font-medium"><CheckCircle2 aria-hidden className="size-5 text-emerald-600" /> Thanks, we&apos;ve got your message</p>
        <p className="text-muted-foreground text-sm">
          We&apos;ve emailed <strong className="text-foreground">{sentTo}</strong> your reference and a private link to your query. We usually answer within one working day. If the email doesn&apos;t arrive, check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-kind" className="text-foreground text-sm font-medium">What would you like to do?</label>
          <Select value={kind} onValueChange={(k) => setKind(k as SupportKind)}>
            <SelectTrigger id="p-kind" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{SUPPORT_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-topic" className="text-foreground text-sm font-medium">What is it about?</label>
          <Select value={topic} onValueChange={(t) => setTopic(t as SupportTopic)}>
            <SelectTrigger id="p-topic" className="w-full"><SelectValue placeholder="Choose a topic" /></SelectTrigger>
            <SelectContent>{topicsFor("public").map((t) => <SelectItem key={t} value={t}>{TOPIC_LABEL[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-name" className="text-foreground text-sm font-medium">Your name</label>
          <Input id="p-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-email" className="text-foreground text-sm font-medium">Your email</label>
          <Input id="p-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          <p className="text-muted-foreground text-xs">We&apos;ll answer here. We don&apos;t use it for anything else.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="p-subject" className="text-foreground text-sm font-medium">Subject</label>
        <Input id="p-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUPPORT_LIMITS.subjectMax} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="p-message" className="text-foreground text-sm font-medium">Your message</label>
        <Textarea id="p-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} placeholder="Tell us what you need. If you can't sign in, say which email address you use." />
      </div>
      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="p-website">Website</label>
        <input id="p-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Send</Button>
        <p className="text-muted-foreground text-xs">Have an account? <Link href="/auth?callbackUrl=/dashboard/help/new" className="text-primary underline underline-offset-2">Sign in</Link> to send it from there and keep track of it.</p>
      </div>
    </form>
  );
}
