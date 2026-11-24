"use client";

/**
 * Settings › Branding (viewer.md "Branding and white-label"): logo, colour,
 * sender name and welcome text on Plus; white-label on Pro. A live preview
 * shows the email header families will see.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TonePanel } from "@/components/ui/nexus";
import { uploadFile } from "@/lib/blob/client";
import { BlobKind, workspaceLogoPath } from "@/lib/blob/paths";

import { setBrandingAction, setWhiteLabelAction } from "../brand-actions";

export type BrandingData = {
  id: string; name: string; slug: string; logoUrl: string | null; accentColor: string | null; senderName: string | null;
  welcomeText: string | null; hideNexaBranding: boolean; supportEmail: string | null;
  canBrand: boolean; canWhiteLabel: boolean; signInUrl: string;
};

const NEXA_ACCENT = "#C16E48";
const HEX = /^#[0-9a-fA-F]{6}$/;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-foreground text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function BrandingForm({ data }: { data: BrandingData }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = React.useState(data.logoUrl);
  const [accent, setAccent] = React.useState(data.accentColor ?? "");
  const [sender, setSender] = React.useState(data.senderName ?? "");
  const [welcome, setWelcome] = React.useState(data.welcomeText ?? "");
  const [white, setWhite] = React.useState(data.hideNexaBranding);
  const [supportEmail, setSupportEmail] = React.useState(data.supportEmail ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState<"brand" | "white" | null>(null);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string; at: "brand" | "white" } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const shownAccent = HEX.test(accent) ? accent : NEXA_ACCENT;
  const shownSender = (sender.trim() || data.name).slice(0, 60);
  const fromLine = white && data.canWhiteLabel ? shownSender : `${shownSender} via Nexa`;
  const locked = !data.canBrand;

  async function pickLogo(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setMessage(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setMessage({ tone: "error", text: "Use a PNG, JPEG or WebP image.", at: "brand" });
    if (f.size > 1024 * 1024) return setMessage({ tone: "error", text: "The logo must be under 1 MB.", at: "brand" });
    setUploading(true);
    try {
      const r = await uploadFile({ kind: BlobKind.WorkspaceLogo, pathname: workspaceLogoPath(data.id, f.name), file: f });
      setLogoUrl(r.url);
    } catch {
      setMessage({ tone: "error", text: "The logo didn't upload. Check your connection and try again.", at: "brand" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (accent && !HEX.test(accent)) return setMessage({ tone: "error", text: "Use a colour code like #1F6FEB, or leave it empty for Nexa's colour.", at: "brand" });
    setBusy("brand");
    const r = await setBrandingAction({ logoUrl: logoUrl ?? null, accentColor: accent || null, senderName: sender.trim() || null, welcomeText: welcome.trim() || null }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setMessage({ tone: "error", text: r?.serverError ?? "That didn't save. Check your connection and try again.", at: "brand" });
    setMessage({ tone: "ok", text: "Saved. New emails to your families use it from now on.", at: "brand" });
    router.refresh();
  }

  async function saveWhite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy("white");
    const r = await setWhiteLabelAction({ hideNexaBranding: white, supportEmail: supportEmail.trim() || null }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setMessage({ tone: "error", text: r?.serverError ?? "That didn't save. Check your connection and try again.", at: "white" });
    setMessage({ tone: "ok", text: white ? "White-label is on. Families' emails no longer mention Nexa." : "White-label is off. Families' emails say they come via Nexa.", at: "white" });
    router.refresh();
  }

  const note = (at: "brand" | "white") =>
    message?.at === at ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-destructive text-sm" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message.text}</p> : null;

  return (
    <div className="flex flex-col gap-10">
      {locked ? (
        <TonePanel tone="accent" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Your logo, colour and sender name are part of the <strong>Plus</strong> plan. Move a course to Plus or Pro in Billing to use them.</p>
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/settings/billing">Open Billing</Link></Button>
        </TonePanel>
      ) : null}

      <section aria-labelledby="brand-h" className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={saveBrand} className="flex flex-col gap-5">
          <div>
            <h2 id="brand-h" className="text-foreground text-base font-semibold">Logo, colour and name</h2>
            <p className="text-muted-foreground text-sm">Shown on the emails your students and parents get from you, and on your own sign-in page.</p>
          </div>
          <fieldset disabled={locked} className="flex flex-col gap-5 disabled:opacity-60">
            <div className="flex flex-col gap-2">
              <span className="text-foreground text-sm font-medium">Logo</span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="border-border bg-muted/40 grid h-14 w-40 place-items-center overflow-hidden rounded-md border">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={`${data.name} logo`} className="max-h-12 max-w-36 object-contain" />
                  ) : (
                    <span className="text-muted-foreground text-xs">No logo</span>
                  )}
                </div>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="logo-file" onChange={(e) => void pickLogo(e.target.files)} />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
                  {logoUrl ? "Change logo" : "Upload a logo"}
                </Button>
                {logoUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                    <Trash2 aria-hidden className="size-4" /> Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">PNG, JPEG or WebP, under 1 MB. A wide logo on a clear background works best; it&apos;s shown about 28 pixels high.</p>
            </div>

            <Field id="accent" label="Colour" hint="Used for buttons and links in your emails. Leave it empty to use Nexa's colour.">
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Pick a colour" value={shownAccent} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="border-border h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1" />
                <Input id="accent" value={accent} onChange={(e) => setAccent(e.target.value.trim())} placeholder={NEXA_ACCENT} maxLength={7} className="w-32 font-mono" />
                {accent ? <Button type="button" variant="ghost" size="sm" onClick={() => setAccent("")}>Use Nexa&apos;s colour</Button> : null}
              </div>
            </Field>

            <Field id="sender" label="Sender name" hint={<>Emails will come from &ldquo;{fromLine}&rdquo;. The address stays Nexa&apos;s, so they arrive safely.</>}>
              <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder={data.name} maxLength={60} className="sm:max-w-sm" />
            </Field>

            <Field id="welcome" label="Welcome text" hint={`Shown on your sign-in page under your name. ${300 - welcome.length} characters left.`}>
              <Textarea id="welcome" rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={300} placeholder={`For example: Welcome to ${data.name}. Sign in to see your classes, work and marks.`} />
            </Field>
          </fieldset>
          {note("brand")}
          <div>
            <Button type="submit" variant="brand" disabled={locked || busy !== null || uploading}>
              {busy === "brand" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save branding
            </Button>
          </div>
        </form>

        <aside aria-label="Preview" className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Preview</p>
          <div className="border-border overflow-hidden rounded-lg border bg-white text-[#1f2328] shadow-xs">
            <div className="border-b border-[#eee] px-4 py-3 text-[11px] text-[#6b7280]">From: <span className="text-[#1f2328]">{fromLine}</span></div>
            <div className="px-4 pt-4 pb-2 text-base font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="" className="mr-2 inline-block h-6 w-auto align-middle" /> : null}
              <span className="align-middle">{data.name}</span>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-4 text-[13px] leading-relaxed">
              <p>Hi Thandiwe,</p>
              <p>Lerato&apos;s marks for Quiz 1 are ready.</p>
              <span className="inline-block w-fit rounded-md px-3 py-1.5 text-[12px] font-medium text-white" style={{ backgroundColor: shownAccent }}>See the marks</span>
              <p className="text-[11px] text-[#6b7280]">{white && data.canWhiteLabel ? `Sent by ${data.name}.` : `Sent by ${data.name} through Nexa LMS.`}</p>
            </div>
          </div>
          {data.canBrand ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-foreground text-sm font-medium">Your sign-in page</p>
              <p className="text-muted-foreground text-xs">Share this link with your students and parents: it shows your logo and welcome text.</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted text-foreground min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">{data.signInUrl}</code>
                <Button type="button" size="sm" variant="outline" aria-label="Copy the link" onClick={() => void navigator.clipboard?.writeText(data.signInUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
                  {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                </Button>
              </div>
              <a href={data.signInUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline underline-offset-2">Open it in a new tab</a>
            </div>
          ) : null}
        </aside>
      </section>

      <form onSubmit={saveWhite} aria-labelledby="white-h" className="border-border flex flex-col gap-4 border-t pt-8">
        <div>
          <h2 id="white-h" className="text-foreground text-base font-semibold">White-label <span className="text-muted-foreground text-sm font-normal">(Pro plan)</span></h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Remove Nexa&apos;s name from the emails your families get and from your sign-in page, so everything comes from {data.name}. Nexa&apos;s own emails, such as billing and password resets, still say Nexa.
          </p>
        </div>
        {!data.canWhiteLabel ? (
          <TonePanel tone="neutral" className="text-sm">White-label is part of the <strong>Pro</strong> plan. Move a course to Pro in Billing to use it.</TonePanel>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              <Switch checked={white} onCheckedChange={setWhite} aria-label="White-label" />
              <span className="text-foreground">{white ? "On: families see only your name" : "Off: emails say they come via Nexa"}</span>
            </div>
            <Field id="support-email" label="Support email" hint="Families who need help are shown this address instead of Nexa's. Required to switch white-label on.">
              <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder={`help@${data.slug}.co.za`} maxLength={254} className="sm:max-w-sm" />
            </Field>
            {note("white")}
            <div>
              <Button type="submit" variant="outline" disabled={busy !== null}>
                {busy === "white" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Save white-label
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
