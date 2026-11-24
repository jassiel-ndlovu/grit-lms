"use client";

/**
 * The enquiry pipeline's interactive parts (viewer.md "Enquiry pipeline"):
 * the add or edit form, the stage control, notes and emails, and the
 * public-form switch.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { addEnquiryNoteAction, createEnquiryAction, emailEnquirerAction, moveEnquiryAction, setEnquiryFormAction, updateEnquiryAction } from "../actions";
import { crmRoutes, MANUAL_SOURCES, SOURCE_LABEL, STAGE_HINT, STAGE_LABEL, STAGE_ORDER, type Stage } from "../crm-ui";

const fail = (r: { serverError?: string; validationErrors?: unknown } | null | undefined) => {
  const v = r?.validationErrors as Record<string, { _errors?: string[] }> | undefined;
  return (v && Object.values(v).find((x) => x?._errors?.length)?._errors?.[0]) ?? r?.serverError ?? "That didn't save. Check your connection and try again.";
};

const SELECT = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm sm:max-w-sm";

/* ------------------------------------------------------------------------- */
/* Add or edit                                                               */
/* ------------------------------------------------------------------------- */

export type EnquiryFormValues = {
  id?: string; name: string; email: string | null; phone: string | null; studentName: string | null; gradeLevel: number | null;
  subjects: string[]; message: string | null; source: string; branchId: string | null; assignedMembershipId: string | null; nextFollowUpAt: string | null;
};

export function EnquiryForm({
  initial, branches, staff, onDone,
}: {
  initial?: EnquiryFormValues;
  branches: Array<{ id: string; name: string }>;
  staff: Array<{ membershipId: string; name: string }>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [v, setV] = React.useState<EnquiryFormValues>(initial ?? { name: "", email: null, phone: null, studentName: null, gradeLevel: null, subjects: [], message: null, source: "PHONE", branchId: null, assignedMembershipId: null, nextFollowUpAt: null });
  const [subjects, setSubjects] = React.useState((initial?.subjects ?? []).join(", "));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof EnquiryFormValues>(k: K, val: EnquiryFormValues[K]) => setV((x) => ({ ...x, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.name.trim().length < 2) return setError("Add the name of the person asking.");
    if (!v.email?.trim() && !v.phone?.trim()) return setError("Add an email address or a phone number, so you can get back to them.");
    setBusy(true);
    const data = {
      name: v.name.trim(), email: v.email?.trim() || null, phone: v.phone?.trim() || null, studentName: v.studentName?.trim() || null,
      gradeLevel: v.gradeLevel, subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10), message: v.message?.trim() || null,
      branchId: v.branchId || null, assignedMembershipId: v.assignedMembershipId || null,
      nextFollowUpAt: v.nextFollowUpAt ? new Date(`${v.nextFollowUpAt}T08:00:00+02:00`) : null,
    };
    const r = editing
      ? await updateEnquiryAction({ id: initial!.id!, ...data }).catch(() => null)
      : await createEnquiryAction({ ...data, source: v.source as (typeof MANUAL_SOURCES)[number] }).catch(() => null);
    setBusy(false);
    if (!r?.data) return setError(fail(r));
    if (editing) { onDone?.(); router.refresh(); }
    else router.push(crmRoutes.one((r.data as { id: string }).id));
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
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-2 text-sm font-semibold">Who is asking</legend>
        {field("q-name", "Name", <Input id="q-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="The parent or student" />)}
        {field("q-email", "Email", <Input id="q-email" type="email" value={v.email ?? ""} onChange={(e) => set("email", e.target.value)} maxLength={254} />)}
        {field("q-phone", "Phone", <Input id="q-phone" type="tel" value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} maxLength={40} />, "An email or a phone number is needed.")}
        {!editing ? field("q-source", "How they found you", (
          <select id="q-source" className={SELECT} value={v.source} onChange={(e) => set("source", e.target.value)}>
            {MANUAL_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        )) : null}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-2 text-sm font-semibold">About the student</legend>
        {field("q-student", "Student's name", <Input id="q-student" value={v.studentName ?? ""} onChange={(e) => set("studentName", e.target.value)} maxLength={120} />)}
        {field("q-grade", "Grade", (
          <select id="q-grade" className={SELECT} value={v.gradeLevel ?? ""} onChange={(e) => set("gradeLevel", e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">Not given</option>
            {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{g === 0 ? "Grade R" : `Grade ${g}`}</option>)}
          </select>
        ))}
        {field("q-subjects", "Subjects", <Input id="q-subjects" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Maths, Physical Sciences" />, "Separate them with commas.")}
        {field("q-message", "What they asked", <Textarea id="q-message" rows={3} value={v.message ?? ""} onChange={(e) => set("message", e.target.value)} maxLength={4000} />)}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-2 text-sm font-semibold">Follow-up</legend>
        {branches.length ? field("q-branch", "Branch", (
          <select id="q-branch" className={SELECT} value={v.branchId ?? ""} onChange={(e) => set("branchId", e.target.value || null)}>
            <option value="">No branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )) : null}
        {field("q-assigned", "Looked after by", (
          <select id="q-assigned" className={SELECT} value={v.assignedMembershipId ?? ""} onChange={(e) => set("assignedMembershipId", e.target.value || null)}>
            <option value="">{editing ? "Nobody" : "Me"}</option>
            {staff.map((s) => <option key={s.membershipId} value={s.membershipId}>{s.name}</option>)}
          </select>
        ))}
        {field("q-follow", "Follow up on", <Input id="q-follow" type="date" value={v.nextFollowUpAt ?? ""} onChange={(e) => set("nextFollowUpAt", e.target.value || null)} className="sm:max-w-48" />, "The person looking after it gets a reminder that day.")}
      </fieldset>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="brand" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}{editing ? "Save changes" : "Add enquiry"}</Button>
        {editing ? <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button> : null}
      </div>
    </form>
  );
}

/** Wraps EnquiryForm with an Edit button on the enquiry page. */
export function EditEnquiry(props: { initial: EnquiryFormValues; branches: Array<{ id: string; name: string }>; staff: Array<{ membershipId: string; name: string }> }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Edit details</Button>;
  return <div className="border-border rounded-lg border p-4"><EnquiryForm {...props} onDone={() => setOpen(false)} /></div>;
}

/* ------------------------------------------------------------------------- */
/* Stage                                                                     */
/* ------------------------------------------------------------------------- */

export function StageControl({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter();
  const [lost, setLost] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<Stage | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function move(to: Stage) {
    if (to === "LOST" && !lost) return setLost(true);
    if (to === "LOST" && reason.trim().length < 2) return setError("Say briefly why they didn't join. It helps you see patterns later.");
    setBusy(to);
    setError(null);
    const r = await moveEnquiryAction({ id, stage: to, ...(to === "LOST" ? { lostReason: reason.trim() } : {}) }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(fail(r));
    setLost(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-foreground text-sm font-medium">Move to</p>
      <div className="flex flex-wrap gap-2">
        {STAGE_ORDER.filter((s) => s !== stage).map((s) => (
          <Button key={s} size="sm" variant={s === "ENROLLED" ? "brand" : "outline"} disabled={busy !== null} title={STAGE_HINT[s]} onClick={() => void move(s)}>
            {busy === s ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}{STAGE_LABEL[s]}
          </Button>
        ))}
      </div>
      {lost ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="lost-reason" className="text-foreground text-sm">Why didn&apos;t they join?</label>
            <Input id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="For example: price, timing, chose another tutor" />
          </div>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void move("LOST")}>Save</Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Notes and email                                                           */
/* ------------------------------------------------------------------------- */

export function NoteAndEmail({ id, email, name, workspaceName }: { id: string; email: string | null; name: string; workspaceName: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"note" | "email">("note");
  const [body, setBody] = React.useState("");
  const [subject, setSubject] = React.useState(`Your enquiry to ${workspaceName}`);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!body.trim()) return setMsg({ ok: false, text: mode === "note" ? "Write the note first." : "Write your message first." });
    setBusy(true);
    const r = mode === "note" ? await addEnquiryNoteAction({ id, body: body.trim() }).catch(() => null) : await emailEnquirerAction({ id, subject: subject.trim(), body: body.trim() }).catch(() => null);
    setBusy(false);
    if (!r?.data) return setMsg({ ok: false, text: fail(r) });
    setBody("");
    setMsg({ ok: true, text: mode === "note" ? "Note added." : `Sent to ${email}. Their reply comes to your own email.` });
    router.refresh();
  }

  return (
    <form onSubmit={send} className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div role="tablist" aria-label="Add a note or send an email" className="flex gap-1">
        <Button type="button" role="tab" aria-selected={mode === "note"} size="sm" variant={mode === "note" ? "secondary" : "ghost"} onClick={() => setMode("note")}><StickyNote aria-hidden className="size-4" /> Note</Button>
        <Button type="button" role="tab" aria-selected={mode === "email"} size="sm" variant={mode === "email" ? "secondary" : "ghost"} disabled={!email} title={email ? undefined : "No email address for this enquiry"} onClick={() => setMode("email")}><Mail aria-hidden className="size-4" /> Email {name.split(" ")[0]}</Button>
      </div>
      {mode === "email" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="em-subject" className="text-foreground text-sm font-medium">Subject</label>
          <Input id="em-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="em-body" className="text-foreground text-sm font-medium">{mode === "note" ? "Note for staff" : `Message to ${email}`}</label>
        <Textarea id="em-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={mode === "note" ? 4000 : 6000}
          placeholder={mode === "note" ? "What happened, or what to do next. Only staff see notes." : "Write every word yourself. Replies come to your own email address."} />
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-destructive text-sm"}>{msg.text}</p> : null}
      <div><Button type="submit" size="sm" variant={mode === "email" ? "brand" : "outline"} disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}{mode === "note" ? "Add note" : "Send email"}</Button></div>
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Public form switch                                                        */
/* ------------------------------------------------------------------------- */

export function EnquiryFormSwitch({ on, url }: { on: boolean; url: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(on);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    const r = await setEnquiryFormAction({ on: next }).catch(() => null);
    setBusy(false);
    if (!r?.data) return setError(fail(r));
    setValue(r.data.on);
    router.refresh();
  }

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={value} disabled={busy} onCheckedChange={(c) => void toggle(c)} aria-label="Online enquiry form" />
        <span className="text-foreground font-medium">Online enquiry form {value ? "is on" : "is off"}</span>
      </div>
      <p className="text-muted-foreground">
        {value ? "Families can ask about classes from this page. Put the link on your website or social media; new enquiries arrive here." : "Switch it on to get a page where families can ask about classes. New enquiries arrive here."}
      </p>
      {value ? (
        <div className="flex items-center gap-2">
          <code className="bg-muted text-foreground min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">{url}</code>
          <Button type="button" size="sm" variant="outline" aria-label="Copy the link" onClick={() => void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    </div>
  );
}
