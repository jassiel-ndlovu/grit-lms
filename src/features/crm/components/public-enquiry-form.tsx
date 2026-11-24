"use client";

/**
 * An organisation's public enquiry form (/enquire/<slug>; viewer.md
 * "Enquiry pipeline"). Families ask about classes; the organisation's staff
 * see it under Enquiries. Same bot screen as the other public forms.
 */

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { submitWorkspaceEnquiryAction } from "../actions";

const SELECT = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

export function PublicEnquiryForm({ slug, name, branches }: { slug: string; name: string; branches: Array<{ id: string; name: string }> }) {
  const [startedAt] = React.useState(() => Date.now());
  const [f, setF] = React.useState({ name: "", email: "", phone: "", studentName: "", grade: "", subjects: "", message: "", branchId: "", website: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.email.trim() && !f.phone.trim()) return setError("Give an email address or a phone number, so they can reach you.");
    setBusy(true);
    const r = await submitWorkspaceEnquiryAction({
      slug, name: f.name, email: f.email, phone: f.phone, studentName: f.studentName || undefined,
      gradeLevel: f.grade === "" ? undefined : Number(f.grade), subjects: f.subjects.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
      message: f.message || undefined, branchId: f.branchId || undefined, startedAt, website: f.website,
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
        <p className="text-foreground flex items-center gap-2 font-medium"><CheckCircle2 aria-hidden className="size-5 text-emerald-600" /> Thanks, {f.name.split(" ")[0] || "we've got it"}</p>
        <p className="text-muted-foreground text-sm">{name} has your message and will get back to you{f.email ? ` at ${f.email}` : f.phone ? ` on ${f.phone}` : ""}.</p>
      </div>
    );
  }

  const field = (id: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-foreground text-sm font-medium">{label}</label>
      {el}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("pe-name", "Your name", <Input id="pe-name" autoComplete="name" value={f.name} onChange={set("name")} maxLength={120} />)}
        {field("pe-email", "Email", <Input id="pe-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} maxLength={254} />)}
        {field("pe-phone", "Phone", <Input id="pe-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} maxLength={40} />, "Give an email or a phone number.")}
        {field("pe-student", "Student's name", <Input id="pe-student" value={f.studentName} onChange={set("studentName")} maxLength={120} placeholder="If you're asking for someone else" />)}
        {field("pe-grade", "Grade", (
          <select id="pe-grade" className={SELECT} value={f.grade} onChange={set("grade")}>
            <option value="">Choose a grade</option>
            {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{g === 0 ? "Grade R" : `Grade ${g}`}</option>)}
          </select>
        ))}
        {field("pe-subjects", "Subjects", <Input id="pe-subjects" value={f.subjects} onChange={set("subjects")} placeholder="Maths, English" />, "Separate them with commas.")}
        {branches.length > 1 ? field("pe-branch", "Which branch?", (
          <select id="pe-branch" className={SELECT} value={f.branchId} onChange={set("branchId")}>
            <option value="">Not sure</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )) : null}
      </div>
      {field("pe-message", "Anything else?", <Textarea id="pe-message" rows={4} value={f.message} onChange={set("message")} maxLength={4000} placeholder="For example: days and times that suit you, or what you need help with." />)}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pe-website">Website</label>
        <input id="pe-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
      </div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Send</Button>
        <p className="text-muted-foreground text-xs">Only {name} sees your details, to reply to you.</p>
      </div>
    </form>
  );
}
