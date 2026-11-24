"use client";

/**
 * Settings › API and webhooks (contracts/api.md): read-only API keys and
 * webhook endpoints. Keys and signing secrets are shown once.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus, RotateCcw, Send, Trash2, Webhook } from "lucide-react";

import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TonePanel } from "@/components/ui/nexus";
import { schoolDateFormat } from "@/lib/datetime";

import {
  createApiKeyAction,
  createWebhookAction,
  deleteWebhookAction,
  listWebhookDeliveriesAction,
  retryWebhookDeliveryAction,
  revokeApiKeyAction,
  rotateWebhookSecretAction,
  testWebhookAction,
  updateWebhookAction,
} from "../actions";

export type ApiKeyRow = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null };
export type EndpointRow = { id: string; url: string; description: string | null; events: string[]; secretPrefix: string; active: boolean; createdAt: string; lastSuccessAt: string | null; failingSince: string | null; disabledReason: string | null };
type Delivery = { id: string; event: string; status: string; attempts: number; lastStatus: number | null; lastError: string | null; createdAt: string | Date; deliveredAt: string | Date | null };

const EVENT_LABEL: Record<string, string> = {
  "enrolment.created": "A student joins a course",
  "enrolment.ended": "A student leaves a course",
  "invoice.paid": "A fee is paid",
  "booking.created": "A lesson is booked",
  "booking.cancelled": "A booked lesson is cancelled",
  "attendance.marked": "Attendance is taken",
  "risk_alert.opened": "A student is flagged at risk",
  "grade.released": "Marks are shared",
};

const fmt = schoolDateFormat({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const when = (d: string | Date | null) => (d ? fmt.format(new Date(d)) : "Never");
const errText = (r: { serverError?: string } | null | undefined) => r?.serverError ?? "That didn't work. Check your connection and try again.";

function OnceSecret({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <TonePanel tone="warning" role="status" className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}. Copy it now: you won&apos;t see it again.</p>
      <div className="flex items-center gap-2">
        <code className="bg-background text-foreground min-w-0 flex-1 overflow-x-auto rounded px-2 py-1.5 text-xs whitespace-nowrap">{value}</code>
        <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true))}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div><Button type="button" size="sm" variant="ghost" onClick={onDone}>I&apos;ve saved it</Button></div>
    </TonePanel>
  );
}

function Checks({ name, options, value, onChange }: { name: string; options: Array<{ key: string; label: string }>; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.key} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name={name} className="accent-primary mt-0.5" checked={value.includes(o.key)} onChange={(e) => onChange(e.target.checked ? [...value, o.key] : value.filter((x) => x !== o.key))} />
          <span><span className="text-foreground">{o.label}</span> <code className="text-muted-foreground text-[11px]">{o.key}</code></span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function DevelopersPanel({ scopes, events, keys, endpoints, apiBase }: { scopes: Array<{ key: string; label: string }>; events: string[]; keys: ApiKeyRow[]; endpoints: EndpointRow[]; apiBase: string }) {
  return (
    <div className="flex flex-col gap-12">
      <KeysSection scopes={scopes} keys={keys} apiBase={apiBase} />
      <WebhooksSection events={events} endpoints={endpoints} />
    </div>
  );
}

function KeysSection({ scopes, keys, apiBase }: { scopes: Array<{ key: string; label: string }>; keys: ApiKeyRow[]; apiBase: string }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [expires, setExpires] = React.useState("365");
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const now = Date.now();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Give the key a name, such as the system that will use it.");
    if (!chosen.length) return setError("Choose at least one thing the key can read.");
    setBusy("create");
    const r = await createApiKeyAction({ name: name.trim(), scopes: chosen, expiresInDays: expires === "never" ? null : Number(expires) }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(errText(r));
    setNewKey(r.data.key);
    setCreating(false);
    setName("");
    setChosen([]);
    router.refresh();
  }

  async function revoke(k: ApiKeyRow) {
    if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working straight away. This can't be undone.`)) return;
    setBusy(k.id);
    const r = await revokeApiKeyAction({ id: k.id }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(errText(r));
    router.refresh();
  }

  const status = (k: ApiKeyRow) =>
    k.revokedAt ? <StatusChip tone="neutral">Revoked</StatusChip> : k.expiresAt && new Date(k.expiresAt).getTime() < now ? <StatusChip tone="warning">Expired</StatusChip> : <StatusChip tone="success">Active</StatusChip>;

  return (
    <section aria-labelledby="keys-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="keys-h" className="text-foreground flex items-center gap-2 text-base font-semibold"><KeyRound aria-hidden className="size-4" /> API keys</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Let another system (a reporting tool, your school&apos;s admin system) read data from Nexa. Keys can only read, never change anything, and only what you tick.
          </p>
        </div>
        {!creating ? <Button size="sm" variant="outline" onClick={() => { setCreating(true); setNewKey(null); }}><Plus aria-hidden className="size-4" /> New key</Button> : null}
      </div>

      {newKey ? <OnceSecret label="Your new API key" value={newKey} onDone={() => setNewKey(null)} /> : null}

      {creating ? (
        <form onSubmit={create} className="border-border flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="key-name" className="text-foreground text-sm font-medium">Name</label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="For example: Finance reports" className="sm:max-w-sm" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-foreground mb-1 text-sm font-medium">What it can read</legend>
            <Checks name="scopes" options={scopes} value={chosen} onChange={setChosen} />
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="key-expiry" className="text-foreground text-sm font-medium">Stops working after</label>
            <select id="key-expiry" value={expires} onChange={(e) => setExpires(e.target.value)} className="border-input bg-background h-9 w-48 rounded-md border px-2 text-sm">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
              <option value="never">Never (not recommended)</option>
            </select>
          </div>
          {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="brand" size="sm" disabled={busy !== null}>{busy === "create" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Create key</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCreating(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No keys yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">{k.name} {status(k)}</p>
                <p className="text-muted-foreground text-xs"><code>{k.prefix}…</code> · reads {k.scopes.map((s) => scopes.find((x) => x.key === s)?.label.toLowerCase() ?? s).join(", ")}</p>
                <p className="text-muted-foreground text-xs">Created {when(k.createdAt)} · last used {when(k.lastUsedAt)}{k.revokedAt ? ` · revoked ${when(k.revokedAt)}` : k.expiresAt ? ` · stops ${when(k.expiresAt)}` : ""}</p>
              </div>
              {!k.revokedAt ? (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void revoke(k)}>
                  {busy === k.id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error && !creating ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      <details className="border-border rounded-lg border px-4 py-3 text-sm">
        <summary className="text-foreground cursor-pointer font-medium">For your developer: how to use a key</summary>
        <div className="text-muted-foreground mt-2 flex flex-col gap-2">
          <p>Send the key in the <code>Authorization</code> header. Everything is read-only, newest first, 50 items a page (up to 100 with <code>limit</code>); pass <code>cursor</code> for the next page. Up to 120 requests a minute per key.</p>
          <pre className="bg-muted text-foreground overflow-x-auto rounded p-3 text-xs">{`curl ${apiBase}/courses \\\n  -H "Authorization: Bearer nexa_live_…"`}</pre>
          <p>Endpoints: <code>/courses</code>, <code>/learners</code>, <code>/grades</code>, <code>/attendance</code>, <code>/invoices</code>, <code>/bookings</code>. Money is in cents (ZAR); dates are ISO 8601 in UTC.</p>
        </div>
      </details>
    </section>
  );
}

function WebhooksSection({ events, endpoints }: { events: string[]; endpoints: EndpointRow[] }) {
  const router = useRouter();
  const options = events.filter((e) => e !== "enrolment.ended").map((e) => ({ key: e, label: EVENT_LABEL[e] ?? e }));
  const [creating, setCreating] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [secret, setSecret] = React.useState<{ label: string; value: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [deliveries, setDeliveries] = React.useState<Record<string, Delivery[] | "loading">>({});

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^https:\/\//.test(url.trim())) return setError("The address must start with https://");
    if (!chosen.length) return setError("Choose at least one event to send.");
    setBusy("create");
    const r = await createWebhookAction({ url: url.trim(), events: chosen, description: desc.trim() || null }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(errText(r));
    setSecret({ label: "Signing secret for your new webhook", value: r.data.secret });
    setCreating(false);
    setUrl("");
    setDesc("");
    setChosen([]);
    router.refresh();
  }

  async function act(id: string, key: string, fn: () => Promise<{ data?: unknown; serverError?: string } | undefined | null>, ok?: (d: never) => void) {
    setBusy(`${key}:${id}`);
    setError(null);
    const r = await fn().catch(() => null);
    setBusy(null);
    if (!r || r.data === undefined) return setError(errText(r as { serverError?: string }));
    ok?.(r.data as never);
    router.refresh();
  }

  async function loadDeliveries(id: string) {
    if (deliveries[id] && deliveries[id] !== "loading") return setDeliveries((d) => { const n = { ...d }; delete n[id]; return n; });
    setDeliveries((d) => ({ ...d, [id]: "loading" }));
    const r = await listWebhookDeliveriesAction({ id, limit: 20 }).catch(() => null);
    setDeliveries((d) => ({ ...d, [id]: (r?.data as Delivery[] | undefined) ?? [] }));
  }

  const status = (w: EndpointRow) =>
    !w.active ? <StatusChip tone="neutral">Off</StatusChip> : w.failingSince ? <StatusChip tone="warning">Failing</StatusChip> : <StatusChip tone="success">On</StatusChip>;

  return (
    <section aria-labelledby="hooks-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="hooks-h" className="text-foreground flex items-center gap-2 text-base font-semibold"><Webhook aria-hidden className="size-4" /> Webhooks</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Tell another system the moment something happens in Nexa, such as a fee being paid or a student joining. Nexa sends a signed message to the address you give, usually within 5 minutes, and tries again if it fails.
          </p>
        </div>
        {!creating ? <Button size="sm" variant="outline" onClick={() => { setCreating(true); setSecret(null); }}><Plus aria-hidden className="size-4" /> New webhook</Button> : null}
      </div>

      {secret ? <OnceSecret label={secret.label} value={secret.value} onDone={() => setSecret(null)} /> : null}

      {creating ? (
        <form onSubmit={create} className="border-border flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hook-url" className="text-foreground text-sm font-medium">Address (https)</label>
            <Input id="hook-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://example.co.za/nexa/webhook" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hook-desc" className="text-foreground text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input id="hook-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={120} placeholder="For example: Accounting system" className="sm:max-w-sm" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-foreground mb-1 text-sm font-medium">Send a message when</legend>
            <Checks name="events" options={options} value={chosen} onChange={setChosen} />
          </fieldset>
          {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="brand" size="sm" disabled={busy !== null}>{busy === "create" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}Add webhook</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCreating(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {endpoints.length === 0 ? (
        <p className="text-muted-foreground text-sm">No webhooks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {endpoints.map((w) => {
            const d = deliveries[w.id];
            return (
              <li key={w.id} className="border-border flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="break-all">{w.description || w.url}</span> {status(w)}
                    </p>
                    {w.description ? <p className="text-muted-foreground text-xs break-all">{w.url}</p> : null}
                    <p className="text-muted-foreground text-xs">{w.events.map((e) => EVENT_LABEL[e] ?? e).join(" · ")}</p>
                    <p className="text-muted-foreground text-xs">Last delivered {when(w.lastSuccessAt)} · secret <code>{w.secretPrefix}…</code></p>
                    {w.disabledReason ? <p className="text-destructive text-xs">Switched off: {w.disabledReason}</p> : w.failingSince ? <p className="text-xs text-amber-700 dark:text-amber-400">Failing since {when(w.failingSince)}. It switches off after 3 days of failures.</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(w.id, "test", () => testWebhookAction({ id: w.id }), (r: { ok: boolean; status: number | null; error: string | null; ms: number }) => setNotes((n) => ({ ...n, [w.id]: r.ok ? `Test delivered (${r.status}, ${r.ms} ms).` : `Test failed: ${r.error ?? `status ${r.status}`}.` })))}>
                    {busy === `test:${w.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />} Send a test
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(w.id, "toggle", () => updateWebhookAction({ id: w.id, active: !w.active }))}>
                    {w.active ? "Switch off" : "Switch on"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => { if (window.confirm("Make a new signing secret? The old one stops working straight away, so update your system at the same time.")) void act(w.id, "rotate", () => rotateWebhookSecretAction({ id: w.id }), (r: { secret: string }) => setSecret({ label: "New signing secret", value: r.secret })); }}>
                    <RotateCcw aria-hidden className="size-4" /> New secret
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void loadDeliveries(w.id)}>{d && d !== "loading" ? "Hide recent deliveries" : "Recent deliveries"}</Button>
                  <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { if (window.confirm(`Delete this webhook? Nexa stops sending to ${w.url}.`)) void act(w.id, "delete", () => deleteWebhookAction({ id: w.id })); }}>
                    <Trash2 aria-hidden className="size-4" /> Delete
                  </Button>
                </div>
                {notes[w.id] ? <p role="status" className="text-sm">{notes[w.id]}</p> : null}
                {d === "loading" ? <p className="text-muted-foreground text-xs">Loading…</p> : d ? (
                  d.length === 0 ? <p className="text-muted-foreground text-xs">Nothing sent in the last 30 days.</p> : (
                    <ul className="divide-border border-border divide-y rounded-md border text-xs">
                      {d.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-foreground">{EVENT_LABEL[x.event] ?? x.event}</span>
                          <span className="text-muted-foreground">{when(x.createdAt as string)} · {x.status === "SENT" ? `delivered (${x.lastStatus})` : x.status === "FAILED" ? `failed after ${x.attempts} tries${x.lastError ? `: ${x.lastError}` : ""}` : `waiting (try ${x.attempts + 1})`}</span>
                          {x.status === "FAILED" ? <Button size="sm" variant="ghost" onClick={() => void act(x.id, "retry", () => retryWebhookDeliveryAction({ deliveryId: x.id }), () => void loadDeliveries(w.id))}>Send again</Button> : null}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error && !creating ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      <details className="border-border rounded-lg border px-4 py-3 text-sm">
        <summary className="text-foreground cursor-pointer font-medium">For your developer: checking a webhook is from Nexa</summary>
        <div className="text-muted-foreground mt-2 flex flex-col gap-2">
          <p>Each message is JSON: <code>{`{ id, type, created, workspace, data }`}</code>. The same <code>id</code> can arrive twice, so ignore repeats.</p>
          <p>The <code>Nexa-Signature</code> header is <code>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>, where v1 is the HMAC-SHA256 of <code>&lt;t&gt;.&lt;raw body&gt;</code> with your signing secret. Compare it in constant time and reject messages more than 5 minutes old. Reply with any 2xx within 8 seconds.</p>
        </div>
      </details>
    </section>
  );
}
