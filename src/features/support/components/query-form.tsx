"use client";

/**
 * The contact form (support.md): what kind of message, what it's about, who
 * should answer, and the message itself, with up to three screenshots.
 * Students and parents see "Who should answer?" with a suggestion that
 * follows the topic; staff always reach Nexa.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, supportAttachmentPath } from "@/lib/blob/paths";
import { cn } from "@/lib/utils";

import { submitQueryAction } from "../actions";
import {
  defaultRoute,
  KIND_HINT,
  KIND_LABEL,
  SUPPORT_KINDS,
  SUPPORT_LIMITS,
  TOPIC_LABEL,
  topicsFor,
  type SupportKind,
  type SupportPersona,
  type SupportRoute,
  type SupportTopic,
} from "../support-rules";
import { supportErrorMessage, supportRoutes } from "../support-ui";

export type QueryFormContext = {
  userId: string;
  persona: SupportPersona;
  organisations: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string; workspaceId: string; forName: string | null }>;
};

const NONE = "__none";

export function QueryForm({
  context,
  initialKind,
  initialTopic,
  fromPath,
}: {
  context: QueryFormContext;
  initialKind?: SupportKind;
  initialTopic?: SupportTopic;
  fromPath?: string | null;
}) {
  const router = useRouter();
  const family = context.persona === "learner" || context.persona === "guardian";
  const topics = topicsFor(context.persona);
  const [kind, setKind] = React.useState<SupportKind>(initialKind ?? "QUESTION");
  const [topic, setTopic] = React.useState<SupportTopic | "">(initialTopic && topics.includes(initialTopic) ? initialTopic : "");
  const [routeTouched, setRouteTouched] = React.useState(false);
  const [route, setRoute] = React.useState<SupportRoute>("NEXA");
  const [workspaceId, setWorkspaceId] = React.useState(context.organisations.length === 1 ? context.organisations[0].id : "");
  const [courseId, setCourseId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [files, setFiles] = React.useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  // The suggestion follows the topic until the person picks for themselves.
  React.useEffect(() => {
    if (!routeTouched && topic) setRoute(defaultRoute(context.persona, topic, context.organisations.length > 0));
  }, [topic, routeTouched, context.persona, context.organisations.length]);

  const coursesHere = context.courses.filter((c) => !workspaceId || c.workspaceId === workspaceId);
  const askOrganisation = family && route === "WORKSPACE";

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = SUPPORT_LIMITS.attachmentsMax - files.length;
    const picked = [...list].slice(0, room);
    for (const f of picked) {
      if (!SUPPORT_LIMITS.attachmentTypes.includes(f.type)) return setError("Screenshots must be PNG, JPEG or WebP images.");
      if (f.size > SUPPORT_LIMITS.attachmentBytesMax) return setError(`${f.name} is over 5 MB. Try a smaller screenshot.`);
    }
    setUploading(true);
    try {
      for (const f of picked) {
        const r = await uploadFile({ kind: BlobKind.SupportAttachment, pathname: supportAttachmentPath(context.userId, f.name), file: f });
        setFiles((prev) => [...prev, { name: f.name, url: r.url }]);
      }
    } catch {
      setError("A screenshot didn't upload. Check your connection and try again, or send your message without it.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!topic) return setError("Choose what your message is about.");
    if (askOrganisation && !workspaceId) return setError("Choose which tutor or school should answer.");
    setBusy(true);
    const r = await submitQueryAction({
      kind, topic, subject, message,
      ...(family ? { route } : {}),
      ...(askOrganisation && workspaceId ? { workspaceId } : {}),
      ...(courseId ? { courseId } : {}),
      ...(fromPath ? { pagePath: fromPath } : {}),
      attachments: files.map((f) => f.url),
    }).catch(() => null);
    if (!r?.data) {
      const v = r?.validationErrors as { subject?: { _errors?: string[] }; message?: { _errors?: string[] } } | undefined;
      setError(v?.subject?._errors?.[0] ?? v?.message?._errors?.[0] ?? supportErrorMessage(r?.serverError));
      setBusy(false);
      return;
    }
    router.push(`${supportRoutes.query(r.data.id)}?sent=1`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-foreground mb-1 text-sm font-medium">What would you like to do?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SUPPORT_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "border-border hover:bg-muted/50 flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm",
                kind === k && "border-primary ring-primary/30 ring-2",
              )}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-primary" />
                <span className="text-foreground font-medium">{KIND_LABEL[k]}</span>
              </span>
              <span className="text-muted-foreground text-xs">{KIND_HINT[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="q-topic" className="text-foreground text-sm font-medium">What is it about?</label>
        <Select value={topic} onValueChange={(t) => setTopic(t as SupportTopic)}>
          <SelectTrigger id="q-topic" className="sm:max-w-sm">
            <SelectValue placeholder="Choose a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t) => (
              <SelectItem key={t} value={t}>{TOPIC_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {family && context.organisations.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-foreground mb-1 text-sm font-medium">Who should answer?</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="route" className="accent-primary mt-1" checked={route === "WORKSPACE"} onChange={() => { setRoute("WORKSPACE"); setRouteTouched(true); }} />
            <span>
              <span className="text-foreground font-medium">My tutor or school</span>
              <span className="text-muted-foreground block text-xs">For your classes, tests, marks, bookings and fees.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="route" className="accent-primary mt-1" checked={route === "NEXA"} onChange={() => { setRoute("NEXA"); setRouteTouched(true); }} />
            <span>
              <span className="text-foreground font-medium">Nexa support</span>
              <span className="text-muted-foreground block text-xs">For signing in, your account, and problems with the app itself.</span>
            </span>
          </label>
        </fieldset>
      ) : null}

      {askOrganisation && context.organisations.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q-org" className="text-foreground text-sm font-medium">Which tutor or school?</label>
          <Select value={workspaceId} onValueChange={(id) => { setWorkspaceId(id); setCourseId(""); }}>
            <SelectTrigger id="q-org" className="sm:max-w-sm"><SelectValue placeholder="Choose one" /></SelectTrigger>
            <SelectContent>
              {context.organisations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {family && coursesHere.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q-course" className="text-foreground text-sm font-medium">
            Which class? <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Select value={courseId || NONE} onValueChange={(id) => setCourseId(id === NONE ? "" : id)}>
            <SelectTrigger id="q-course" className="sm:max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not about one class</SelectItem>
              {coursesHere.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.forName ? `${c.name} (${c.forName})` : c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {askOrganisation ? <p className="text-muted-foreground text-xs">Choosing a class sends your message to the tutors who teach it.</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="q-subject" className="text-foreground text-sm font-medium">Subject</label>
        <Input id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUPPORT_LIMITS.subjectMax} placeholder={kind === "PROBLEM" ? "For example: The Grades page shows no marks" : "A few words about your message"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="q-message" className="text-foreground text-sm font-medium">Your message</label>
        <Textarea id="q-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={7}
          placeholder={kind === "PROBLEM" ? "What were you trying to do? What happened instead? If you saw an error message, copy it here." : kind === "FEEDBACK" ? "What would make Nexa better for you?" : "Tell us what you need. The more detail, the faster we can help."} />
        {fromPath ? <p className="text-muted-foreground text-xs">We&apos;ll include the page you came from, so whoever answers can see what you saw.</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-foreground text-sm font-medium">Screenshots <span className="text-muted-foreground font-normal">(optional, up to 3)</span></span>
        {files.length ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.url} className="border-border flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                <span className="max-w-48 truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setFiles((prev) => prev.filter((x) => x.url !== f.url))}>
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {files.length < SUPPORT_LIMITS.attachmentsMax ? (
          <div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" id="q-files" onChange={(e) => void addFiles(e.target.files)} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
              {uploading ? "Uploading…" : "Add a screenshot"}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={busy || uploading}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Send
        </Button>
        <p className="text-muted-foreground text-xs">
          {askOrganisation ? "Your tutor or school gets a notification. You'll be told when they reply." : "We usually answer within one working day. You'll be told when we reply."}
        </p>
      </div>
    </form>
  );
}
