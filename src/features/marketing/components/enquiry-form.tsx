"use client";

/**
 * "Request access" and "Talk to us about your organisation" (landing page;
 * viewer.md "Landing page"). Sends to A's submitPlatformEnquiry: the Nexa
 * team gets it, nothing is emailed to the sender. Same bot screen as the
 * other public forms.
 */

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { submitPlatformEnquiry } from "../enquiry-actions";
import type { EnquiryKind } from "../enquiry-rules";

const KINDS: Array<{ kind: EnquiryKind; label: string; hint: string }> = [
  { kind: "ACCESS", label: "I want an account", hint: "You're a tutor, a student or a parent." },
  { kind: "TEAM", label: "For our organisation", hint: "A school, centre or team of tutors." },
  { kind: "OTHER", label: "Something else", hint: "Partnerships, press or anything else." },
];

const PROMPT: Record<EnquiryKind, string> = {
  ACCESS: "Tell us who you are (tutor, student or parent) and, if you know it, the course or tutor you want to join.",
  TEAM: "Tell us about your organisation: what you teach, and how you run classes and fees today.",
  OTHER: "How can we help?",
};

export function EnquiryForm({ initialKind = "ACCESS", source }: { initialKind?: EnquiryKind; source?: string }) {
  const [startedAt] = React.useState(() => Date.now());
  const [kind, setKind] = React.useState<EnquiryKind>(initialKind);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [organisation, setOrganisation] = React.useState("");
  const [students, setStudents] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await submitPlatformEnquiry({
      kind, name, email, message, startedAt, website,
      ...(phone ? { phone } : {}),
      ...(kind === "TEAM" && organisation ? { organisation } : {}),
      ...(kind === "TEAM" && students ? { students: Number(students) } : {}),
      ...(source ? { source } : {}),
    }).catch(() => null);
    setBusy(false);
    if (!r?.data) {
      const v = r?.validationErrors as Record<string, { _errors?: string[] }> | undefined;
      const first = v && Object.values(v).find((x) => x?._errors?.length)?._errors?.[0];
      return setError(first ?? r?.serverError ?? "We couldn't send your message just now. Check your connection and try again.");
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="border-border flex flex-col gap-2 rounded-lg border p-5">
        <p className="text-foreground flex items-center gap-2 font-medium"><CheckCircle2 aria-hidden className="size-5 text-emerald-600" /> Thanks, {name.split(" ")[0] || "we've got it"}</p>
        <p className="text-muted-foreground text-sm">
          We&apos;ll reply to <strong className="text-foreground">{email}</strong>, usually within one working day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-foreground mb-1 text-sm font-medium">What are you looking for?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <label key={k.kind} className={cn("border-border hover:bg-muted/50 flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm", kind === k.kind && "border-primary ring-primary/30 ring-2")}>
              <span className="flex items-center gap-2">
                <input type="radio" name="kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="accent-primary" />
                <span className="text-foreground font-medium">{k.label}</span>
              </span>
              <span className="text-muted-foreground text-xs">{k.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-name" className="text-foreground text-sm font-medium">Your name</label>
          <Input id="e-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-email" className="text-foreground text-sm font-medium">Your email</label>
          <Input id="e-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-phone" className="text-foreground text-sm font-medium">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input id="e-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </div>
        {kind === "TEAM" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="e-org" className="text-foreground text-sm font-medium">Organisation</label>
              <Input id="e-org" autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={160} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="e-students" className="text-foreground text-sm font-medium">Number of students <span className="text-muted-foreground font-normal">(about)</span></label>
              <Input id="e-students" inputMode="numeric" value={students} onChange={(e) => setStudents(e.target.value.replace(/[^\d]/g, ""))} maxLength={7} />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-message" className="text-foreground text-sm font-medium">Your message</label>
        <Textarea id="e-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} placeholder={PROMPT[kind]} />
      </div>

      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="e-website">Website</label>
        <input id="e-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Send</Button>
        <p className="text-muted-foreground text-xs">We only use your details to reply to you. See our <a href="/privacy-policy" className="underline underline-offset-2">privacy policy</a>.</p>
      </div>
    </form>
  );
}
